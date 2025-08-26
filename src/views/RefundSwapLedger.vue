<template>
    <div v-if="state !== State.NONE" class="container">
        <SmallPage>
            <LedgerUi
                @information-shown="ledgerInstructionsShown = true"
                @no-information-shown="ledgerInstructionsShown = false"
            />
            <transition name="transition-fade">
                <StatusScreen v-if="state === State.SYNCING_FAILED || !ledgerInstructionsShown"
                    :state="statusScreenState"
                    :title="statusScreenTitle"
                    :status="statusScreenStatus"
                    :message="statusScreenMessage"
                    :mainAction="statusScreenAction"
                    @main-action="_statusScreenActionHandler"
                />
            </transition>
        </SmallPage>

        <GlobalClose :hidden="!isGlobalCloseShown" />
    </div>
</template>

<script lang="ts">
import { Component } from 'vue-property-decorator';
import { Getter } from 'vuex-class';
import { SmallPage } from '@nimiq/vue-components';
import RefundSwap from './RefundSwap.vue';
import StatusScreen from '../components/StatusScreen.vue';
import GlobalClose from '../components/GlobalClose.vue';
import LedgerUi from '../components/LedgerUi.vue';
import Network from '../components/Network.vue';
import { SwapAsset } from '@nimiq/fastspot-api';
import Config from 'config';
import {
    RequestType,
    SignTransactionRequest,
    SignBtcTransactionRequest,
    SignedTransaction,
    SignedBtcTransaction,
} from '../../client/PublicRequestTypes';
import {
    ParsedRefundSwapRequest,
    ParsedSignTransactionRequest,
    ParsedSignBtcTransactionRequest,
} from '../lib/RequestTypes';
import { RequestParser } from '../lib/RequestParser';
import staticStore, { Static } from '../lib/StaticStore';
import { WalletInfo } from '../lib/WalletInfo';
import { BTC_NETWORK_TEST } from '../lib/bitcoin/BitcoinConstants';
import { loadBitcoinJS } from '../lib/bitcoin/BitcoinJSLoader';
import { decodeBtcScript } from '../lib/bitcoin/BitcoinHtlcUtils';
import LedgerSwapProxy, { LedgerSwapProxyMarker } from '../lib/LedgerSwapProxy';
import { ERROR_CANCELED } from '../lib/Constants';
import { BitcoinTransactionInputType } from '@nimiq/keyguard-client';

// Import only types to avoid bundling of KeyguardClient in Ledger request if not required.
// (But note that currently, the KeyguardClient is still always bundled in the RpcApi).
type KeyguardSignNimTransactionRequest = import('@nimiq/keyguard-client').SignTransactionRequestStandard;
type KeyguardSignBtcTransactionRequest = import('@nimiq/keyguard-client').SignBtcTransactionRequestStandard;

type LedgerApiNetwork = import('@nimiq/ledger-api').Network;

@Component({components: {StatusScreen, SmallPage, GlobalClose, LedgerUi}})
export default class RefundSwapLedger extends RefundSwap {
    protected get State() {
        return {
            ...super.State,
            LEDGER_HTLC_UNSUPPORTED: 'ledger-htlc-unsupported',
        };
    }

    @Static protected request!: ParsedRefundSwapRequest | ParsedSignTransactionRequest
        | ParsedSignBtcTransactionRequest;
    @Static protected sideResult?: SignedTransaction | SignedBtcTransaction | Error;
    @Getter private findWalletByAddress!: (address: string, includeContracts: boolean) => WalletInfo | undefined;
    private ledgerInstructionsShown = false; // can happen for LedgerSwapProxy LederApi calls

    protected async created() {
        if (this.request.kind === RequestType.REFUND_SWAP) {
            if ((this.request as ParsedRefundSwapRequest).refund.type === SwapAsset.NIM) {
                // start syncing with the network for later retrieving transaction histories in LedgerSwapProxy
                (new Network()).getNetworkClient().catch(() => void 0);
            }

            // first entry point into the flow is handled by the parent class which then calls _signTransaction
            return;
        }

        // After returning from transaction signing side request

        if (!this.sideResult) {
            this.$rpc.reject(new Error('Unexpected: transaction signing did not return a side result'));
            return;
        } else if (this.sideResult instanceof Error) {
            this.$rpc.reject(this.sideResult);
            return;
        }

        if (this.request.kind === RequestType.SIGN_TRANSACTION) {
            // Nimiq transaction

            this.state = this.State.SYNCING; // proxy transaction history is synced in LedgerSwapProxy.createForRefund

            const request = this.request as ParsedSignTransactionRequest;
            const { sender: senderInfo, recipient, value, fee, data, validityStartHeight } = request;
            if (!senderInfo) {
                this.$rpc.reject(new Error('Ledger Swap Refunding expects a sender in the request.'));
                return;
            }
            const sender = senderInfo instanceof Nimiq.Address ? senderInfo : senderInfo.address;
            // existence guaranteed as already checked previously in RefundSwap
            const ledgerAccount = this.findWalletByAddress(recipient.toUserFriendlyAddress(), true)!;

            let refundTransaction: Nimiq.Transaction;
            try {
                // Retrieve the proxy key for this swap from the Ledger
                const swapProxy = await LedgerSwapProxy.createForRefund(
                    sender,
                    ledgerAccount.findSignerForAddress(recipient)!.path,
                    ledgerAccount.keyId,
                );

                if (swapProxy.canSignLocally) {
                    refundTransaction = await swapProxy.signTransaction({
                        recipient, // Can directly send to recipient, the proxy just needs to sign.
                        value: BigInt(value),
                        fee: BigInt(fee),
                        validityStartHeight,
                        // extraData: data, // data is the swap proxy marker which we don't want for redeeming from htlc
                        network: Config.network as LedgerApiNetwork,
                        ...swapProxy.getRefundInfo(sender),
                    });
                } else if (sender.equals(swapProxy.address)) {
                    // Refund from the proxy via the Ledger transaction we signed.
                    refundTransaction = Nimiq.Transaction.fromAny(this.sideResult.serializedTx);
                    // Convert the single sig proof of the signed transaction into the proxy multi sig proof.
                    const {
                        publicKey: ledgerSignerPublicKey,
                        signature,
                    } = Nimiq.SignatureProof.deserialize(new Nimiq.SerialBuffer(refundTransaction.proof));
                    refundTransaction.proof = swapProxy.createSignatureProof(
                        ledgerSignerPublicKey as Nimiq.PublicKey,
                        signature,
                    ).serialize();
                } else {
                    // Refunding from the HTLC is currently not supported by the Ledger app
                    this.state = this.State.LEDGER_HTLC_UNSUPPORTED;
                    return;
                }
            } catch (e) {
                this.$rpc.reject(
                    e.message.toLowerCase().indexOf('cancelled') !== -1
                        ? new Error(ERROR_CANCELED)
                        : e as Error,
                );
                return;
            }

            if (refundTransaction.senderType === Nimiq.AccountType.HTLC) {
                // create htlc timeout resolve transaction proof
                const proof = new Nimiq.SerialBuffer(1 + refundTransaction.proof.length);
                proof.writeUint8(2 /* Nimiq.HashedTimeLockedContract.ProofType.TIMEOUT_RESOLVE */);
                proof.write(refundTransaction.proof);
                refundTransaction.proof = proof;
            }

            // Validate that the transaction is valid
            try {
                refundTransaction.verify();
            } catch (e) {
                this.$rpc.reject(new Error('NIM transaction is invalid'));
                return;
            }

            this.$rpc.resolve(await (new Network()).makeSignTransactionResult(refundTransaction));
        } else if (this.request.kind === RequestType.SIGN_BTC_TRANSACTION) {
            // Bitcoin transaction

            if (!('serializedTx' in this.sideResult && !!this.sideResult.serializedTx)) {
                this.$rpc.reject(new Error('Unexpected: Bitcoin transaction not signed'));
                return;
            }

            await loadBitcoinJS(); // normally it's already loaded at this point, if user didn't reload the page.
            const signedBitcoinTransaction = BitcoinJS.Transaction.fromHex(this.sideResult.serializedTx);

            // set htlc witness for redeeming the BTC htlc

            const htlcInput = signedBitcoinTransaction.ins[0];
            // get signature and signer pub key from default witness generated by ledgerjs (see @ledgerhq/hw-app-btc
            // createTransaction.js creation of the witness towards the end of createTransaction)
            const [inputSignature, signerPubKey] = htlcInput.witness;

            const witnessBytes = BitcoinJS.script.fromASM([
                inputSignature.toString('hex'),
                signerPubKey.toString('hex'),
                'OP_0', // OP_0 (false) activates the refund branch in the HTLC script
                (this.request as ParsedSignBtcTransactionRequest).inputs[0].witnessScript,
            ].join(' '));

            const witnessStack = BitcoinJS.script.toStack(witnessBytes);
            signedBitcoinTransaction.setWitness(0, witnessStack);

            const result: SignedBtcTransaction = {
                serializedTx: signedBitcoinTransaction.toHex(),
                hash: signedBitcoinTransaction.getId(),
            };

            this.$rpc.resolve(result);
        } else {
            this.$rpc.reject(new Error(`Unexpected request type ${this.request.kind}`));
        }
    }

    protected async _signTransaction(request: KeyguardSignNimTransactionRequest | KeyguardSignBtcTransactionRequest) {
        // forward to SignTransactionLedger or SignBtcTransactionLedger
        if ('sender' in request) {
            // Nimiq request
            const { keyId, keyPath, sender, recipient, recipientLabel, value, fee, validityStartHeight } = request;
            const senderAddress = new Nimiq.Address(sender);

            // For Ledgers, the HTLC is currently created by a proxy address, see LedgerSwapProxy, which also needs to
            // sign the refund transaction. The proxy accepts a local key and the Ledger as signers. Let the user
            // confirm and sign the transaction on the Ledger which will then later be used if the local key is not
            // available anymore. However, as the Ledger app currently can not sign HTLC transactions, we always let the
            // user sign the proxy refund transaction instead.
            const signTransactionRequest: SignTransactionRequest = {
                appName: request.appName,
                sender: senderAddress.toUserFriendlyAddress(),
                recipient: new Nimiq.Address(recipient).toUserFriendlyAddress(),
                recipientLabel,
                value,
                fee,
                extraData: LedgerSwapProxyMarker.REDEEM,
                validityStartHeight,
            };
            const parsedSignTransactionRequest = RequestParser.parse(
                signTransactionRequest,
                staticStore.rpcState!,
                RequestType.SIGN_TRANSACTION,
            ) as ParsedSignTransactionRequest;

            parsedSignTransactionRequest.sender = {
                address: senderAddress,
                label: 'Swap HTLC',
                // type: Nimiq.AccountType.HTLC, // Ledgers currently can not sign actual htlc transactions
                signerKeyId: keyId,
                signerKeyPath: keyPath,
            };

            // redirect to SignTransactionLedger
            staticStore.request = parsedSignTransactionRequest;
            staticStore.originalRouteName = `${RequestType.REFUND_SWAP}-ledger`;
            this.$router.replace({ name: `${RequestType.SIGN_TRANSACTION}-ledger` });
        } else {
            // Bitcoin request
            const { walletId: accountId } = this.request as ParsedRefundSwapRequest;
            const { appName, inputs: [htlcInput], recipientOutput: output } = request;

            // Type guard to ensure inputs have a witnessScript
            if (htlcInput.type !== BitcoinTransactionInputType.HTLC_REFUND) {
                throw new Error('UNEXPECTED: Refund input does not have type \'htlc-refund\'');
            }

            this.state = this.State.SYNCING;
            await loadBitcoinJS();
            // note that buffer is marked as external module in vue.config.js and internally, the buffer bundled with
            // BitcoinJS is used, therefore we retrieve it after having BitcoinJS loaded.
            // TODO change this when we don't prebuild BitcoinJS anymore
            const Buffer = await import('buffer').then((module) => module.Buffer);
            const bitcoinNetwork = Config.bitcoinNetwork === BTC_NETWORK_TEST
                ? BitcoinJS.networks.testnet
                : BitcoinJS.networks.bitcoin;
            const htlcAddress = BitcoinJS.address.fromOutputScript(
                Buffer.from(Nimiq.BufferUtils.fromAny(htlcInput.outputScript)),
                bitcoinNetwork,
            );

            // The timeoutTimestamp we parse from the BTC HTLC script is forwarded one hour
            // (because the timeout in the script itself is set back one hour, because the BTC
            // network only accepts locktimes that are at least one hour old). So we need to
            // remove this added hour before using it as the transaction's locktime.
            const { timeoutTimestamp } = await decodeBtcScript(htlcInput.witnessScript!);
            const locktime = timeoutTimestamp - (60 * 60) + 1;
            const sequence = 0xfffffffe; // Signal to use locktime, but do not opt into replace-by-fee

            const signBtcTransactionRequest: SignBtcTransactionRequest = {
                appName,
                accountId,
                inputs: [{
                    ...htlcInput, // also includes the witnessScript
                    sequence,
                    address: htlcAddress,
                }],
                output,
                locktime,
            };
            const parsedSignBtcTransactionRequest = RequestParser.parse(
                signBtcTransactionRequest,
                staticStore.rpcState!,
                RequestType.SIGN_BTC_TRANSACTION,
            ) as ParsedSignBtcTransactionRequest;
            parsedSignBtcTransactionRequest.inputs[0].keyPath = htlcInput.keyPath;

            // Redirect to SignBtcTransactionLedger
            staticStore.request = parsedSignBtcTransactionRequest;
            staticStore.originalRouteName = `${RequestType.REFUND_SWAP}-ledger`;
            this.$router.replace({ name: `${RequestType.SIGN_BTC_TRANSACTION}-ledger` });
        }
    }

    protected get statusScreenState(): StatusScreen.State {
        if (this.state !== this.State.LEDGER_HTLC_UNSUPPORTED) return super.statusScreenState;
        return StatusScreen.State.ERROR;
    }

    protected get statusScreenTitle() {
        switch (this.state) {
            case this.State.SYNCING:
                return this.$t('Syncing') as string;
            case this.State.LEDGER_HTLC_UNSUPPORTED:
                return this.$t('Refund Failed') as string;
            default:
                return super.statusScreenTitle;
        }
    }

    protected get statusScreenStatus() {
        if (this.state !== this.State.SYNCING) return super.statusScreenStatus;
        return this.$t('Syncing with {currency} network...', { currency: this._currencyName }) as string;
    }

    protected get statusScreenMessage() {
        switch (this.state) {
            case this.State.SYNCING_FAILED:
                return this.$t('Syncing with {currency} network failed: {error}', {
                    currency: this._currencyName,
                    error: this.error,
                }) as string;
            case this.State.LEDGER_HTLC_UNSUPPORTED:
                return this.$t('Refunding this Swap is currently not supported on this device or browser. Please use '
                    + 'the device and browser you originally created the Swap with. Otherwise please try again in the '
                    + 'future.',
                ) as string;
            default:
                return super.statusScreenMessage;
        }
    }

    protected get statusScreenAction() {
        if (this.state !== this.State.LEDGER_HTLC_UNSUPPORTED) return super.statusScreenAction;
        return this.$t('Ok') as string;
    }

    protected get isGlobalCloseShown() {
        return this.request.kind === RequestType.REFUND_SWAP // before having signed
            || this.state === this.State.SYNCING_FAILED
            || this.state === this.State.LEDGER_HTLC_UNSUPPORTED;
    }

    private get _currencyName() {
        switch (this.request.kind) {
            case RequestType.SIGN_TRANSACTION: return 'Nimiq';
            case RequestType.SIGN_BTC_TRANSACTION: return 'Bitcoin';
            case RequestType.REFUND_SWAP:
                const { refund: { type: currency } } = this.request as ParsedRefundSwapRequest;
                switch (currency) {
                    case SwapAsset.NIM: return 'Nimiq';
                    case SwapAsset.BTC: return 'Bitcoin';
                    default: // fall through
                }
            default:
                throw new Error('Failed to determine request currency');
        }
    }

    protected _statusScreenActionHandler() {
        if (this.state === this.State.LEDGER_HTLC_UNSUPPORTED) {
            this.$rpc.reject(new Error(ERROR_CANCELED));
        } else {
            super._statusScreenActionHandler();
        }
    }
}
</script>

<style scoped>
    .small-page {
        position: relative;
    }

    .small-page > * {
        position: absolute;
        top: 0;
    }
</style>
