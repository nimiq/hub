<script lang="ts">
import { Component } from 'vue-property-decorator';
import { Getter } from 'vuex-class';
import KeyguardClient from '@nimiq/keyguard-client';
import { PlainOutput, TransactionDetails as BtcTransactionDetails } from '@nimiq/electrum-client';
import { SmallPage } from '@nimiq/vue-components';
import BitcoinSyncBaseView from './BitcoinSyncBaseView.vue';
import {
    init as initFastspotApi,
    SwapAsset,
    PreSwap,
    Swap,
    confirmSwap,
    getSwap,
    NimHtlcDetails,
    BtcHtlcDetails,
    EurHtlcDetails,
    Contract,
} from '@nimiq/fastspot-api';
import StatusScreen from '../components/StatusScreen.vue';
import GlobalClose from '../components/GlobalClose.vue';
import Network from '../components/Network.vue';
import { SetupSwapResult, SignedTransaction, SignedBtcTransaction } from '../lib/PublicRequestTypes';
import { Static } from '../lib/StaticStore';
import { ParsedSetupSwapRequest } from '../lib/RequestTypes';
import { WalletInfo } from '../lib/WalletInfo';
import Config from 'config';
import { getElectrumClient } from '../lib/bitcoin/ElectrumClient';

@Component({components: {SmallPage, StatusScreen, GlobalClose}}) // including components used in parent class
export default class SetupSwapSuccess extends BitcoinSyncBaseView {
    protected get State() {
        return {
            ...super.State,
            FETCHING_SWAP_DATA: 'fetching-swap-data',
            FETCHING_SWAP_DATA_FAILED: 'fetching-swap-data-failed',
            SIGNING_TRANSACTIONS: 'signing-transactions',
        };
    }

    @Static private request!: ParsedSetupSwapRequest;
    // @State private keyguardResult!: KeyguardClient.SignSwapResult;
    @Getter private findWalletByAddress!: (address: string) => WalletInfo | undefined;

    private async mounted() {
        // Confirm swap to Fastspot and get contract details
        this.state = this.State.FETCHING_SWAP_DATA;
        initFastspotApi(Config.fastspot.apiEndpoint, Config.fastspot.apiKey);
        const $nimiqNetwork = new Network();

        let refundAddress = '';
        switch (this.request.fund.type) {
            case SwapAsset.NIM:
                refundAddress = this.request.fund.sender.toUserFriendlyAddress();
                break;
            case SwapAsset.BTC:
                refundAddress = this.request.fund.refundAddress;
                break;
            default: break;
        }

        let redeemAddress: string | object = '';
        switch (this.request.redeem.type) {
            case SwapAsset.NIM:
                redeemAddress = this.request.redeem.recipient.toUserFriendlyAddress();
                break;
            case SwapAsset.BTC:
                redeemAddress = this.request.redeem.output.address;
                break;
            // case SwapAsset.EUR:
            //     // Assemble recipient object
            default: break;
        }

        let confirmedSwap: Swap;
        try {
            confirmedSwap = await confirmSwap({
                id: this.request.swapId,
            } as PreSwap, {
                // Redeem
                asset: this.request.redeem.type,
                address: redeemAddress,
            }, {
                // Refund
                asset: this.request.fund.type,
                address: refundAddress,
            }).catch((error) => {
                if (error.message === 'The swap was already confirmed before.') {
                    return getSwap(this.request.swapId) as Promise<Swap>;
                } else {
                    throw error;
                }
            });

            console.debug('Swap:', confirmedSwap);
        } catch (error) {
            console.error(error);
            this.state = this.State.FETCHING_SWAP_DATA_FAILED;
            this.error = error;
            return;
        }

        // Validate contract details

        if (confirmedSwap.from.asset === SwapAsset.NIM || confirmedSwap.to.asset === SwapAsset.NIM) {
            const nimHtlcData = confirmedSwap.contracts[SwapAsset.NIM]!.htlc as NimHtlcDetails;

            // FIXME: Enable decoding when HTLC is part of CoreJS web-offline build
            // const htlcData = Nimiq.HashedTimeLockedContract.dataToPlain(this.keyguardRequest.redeem.htlcData);
            // if (!('hashAlgorithm' in htlcData)) {
            //     this.$rpc.reject(new Error('UNEXPECTED: Could not decode NIM htlcData'));
            //     return;
            // }
            // const { hashAlgorithm, hashCount } = htlcData;
            // const algorithm = Nimiq.Hash.Algorithm.fromString(hashAlgorithm);
            const nimHtlcByteArray = Nimiq.BufferUtils.fromHex(nimHtlcData.data);

            // TODO: Check that refund address or redeem address is correct (ours)

            const algorithm = nimHtlcByteArray[20 + 20] as Nimiq.Hash.Algorithm;
            const hashCount = nimHtlcByteArray[20 + 20 + 32 + 1];

            if (algorithm === Nimiq.Hash.Algorithm.ARGON2D) {
                // Blacklisted for HTLC creation
                this.$rpc.reject(new Error('Disallowed HTLC hash algorithm (Argon2d)'));
                return;
            }
            const hashSize = Nimiq.Hash.SIZE.get(algorithm)!;
            if (hashSize !== 32) {
                // Hash must be 32 bytes, as otherwise it cannot work with the BTC HTLC
                this.$rpc.reject(new Error('Disallowed HTLC hash length (!= 32 bytes)'));
                return;
            }
            if (hashCount !== 1) {
                // Hash count must be 1 for us to accept the swap
                this.$rpc.reject(new Error('Disallowed HTLC hash count (!= 1)'));
                return;
            }
        }

        // Construct transaction request objects
        const request: Partial<KeyguardClient.SignSwapTransactionsRequest> = {
            swapId: this.request.swapId,
        };

        if (this.request.fund.type === SwapAsset.NIM) {
            const nimHtlcData = confirmedSwap.contracts[SwapAsset.NIM]!.htlc as NimHtlcDetails;
            const nimHtlcByteArray = Nimiq.BufferUtils.fromHex(nimHtlcData.data);

            const nimAddress = this.request.fund.type === SwapAsset.NIM
                ? this.request.fund.sender.toUserFriendlyAddress()
                : this.request.redeem.type === SwapAsset.NIM
                    ? this.request.redeem.recipient.toUserFriendlyAddress()
                    : ''; // Should never happen, if parsing works correctly
            const account = this.findWalletByAddress(nimAddress)!;

            const senderContract = account.findContractByAddress(this.request.fund.sender);
            const signer = account.findSignerForAddress(this.request.fund.sender)!;

            request.fund = {
                type: SwapAsset.NIM,
                htlcData: nimHtlcByteArray,
            };
        }

        if (this.request.fund.type === SwapAsset.BTC) {
            const btcHtlcData = confirmedSwap.contracts[SwapAsset.BTC]!.htlc as BtcHtlcDetails;

            request.fund = {
                type: SwapAsset.BTC,
                htlcScript: Nimiq.BufferUtils.fromHex(btcHtlcData.script),
            };
        }

        if (this.request.fund.type === SwapAsset.EUR) {
            const eurContract = confirmedSwap.contracts[SwapAsset.EUR] as Contract<SwapAsset.EUR>;
            const eurHtlcData = eurContract.htlc;

            request.fund = {
                type: SwapAsset.EUR,
                hash: confirmedSwap.hash, // FIXME: Fetch contract from OASIS API instead of trusting Fastspot
                timeout: eurContract.timeout, // FIXME: Fetch contract from OASIS API instead of trusting Fastspot
                htlcId: eurHtlcData.address,
            };
        }

        if (this.request.redeem.type === SwapAsset.NIM) {
            const nimHtlcData = confirmedSwap.contracts[SwapAsset.NIM]!.htlc as NimHtlcDetails;
            const nimHtlcByteArray = Nimiq.BufferUtils.fromHex(nimHtlcData.data);

            request.redeem = {
                type: SwapAsset.NIM,
                htlcData: nimHtlcByteArray,
                htlcAddress: nimHtlcData.address,
            };
        }

        if (this.request.redeem.type === SwapAsset.BTC) {
            const btcHtlcData = confirmedSwap.contracts[SwapAsset.BTC]!.htlc as BtcHtlcDetails;

            // Fetch missing info from the blockchain
            // BTC tx hash and output data

            try {
                this.state = this.State.SYNCING;
                const { transaction, output } = await new Promise<{
                    transaction: BtcTransactionDetails,
                    output: PlainOutput,
                }>(async (resolve, reject) => {
                    function listener(tx: BtcTransactionDetails) {
                        const htlcOutput = tx.outputs.find((out) => out.address === btcHtlcData.address);
                        if (htlcOutput && htlcOutput.value === confirmedSwap.to.amount) {
                            resolve({
                                transaction: tx,
                                output: htlcOutput,
                            });
                            return true;
                        }
                        return false;
                    }

                    try {
                        const electrum = await getElectrumClient();

                        // First check history
                        const history = await electrum.getTransactionsByAddress(btcHtlcData.address);

                        for (const tx of history) {
                            if (listener(tx)) return;
                        }

                        // Then subscribe to new transactions
                        electrum.addTransactionListener(listener, [btcHtlcData.address]);
                    } catch (error) {
                        reject(error);
                    }
                });

                request.redeem = {
                    type: SwapAsset.BTC,
                    htlcScript: Nimiq.BufferUtils.fromHex(btcHtlcData.script),
                    transactionHash: transaction.transactionHash,
                    outputIndex: output.index,
                };
            } catch (error) {
                console.error(error);
                this.state =  this.State.SYNCING_FAILED;
                this.error = error;
                return;
            }
        }

        // if (this.request.redeem.type === SwapAsset.EUR) {
        //
        // }

        // Sign transactions via Keyguard swap-iframe
        this.state = this.State.SIGNING_TRANSACTIONS;
        const client = this.$rpc.createKeyguardClient();
        let keyguardResult: KeyguardClient.SignSwapTransactionsResult;
        try {
            keyguardResult = await client
                .signSwapTransactions(request as KeyguardClient.SignSwapTransactionsRequest);
        } catch (error) {
            this.$rpc.reject(error);
            return;
        }

        // Construct Hub response
        const result: SetupSwapResult = {};

        // Nimiq transaction is assembled here from KeyguardClient.SignatureResult
        let nimTx: Nimiq.Transaction | null = null;
        if (this.request.fund.type === SwapAsset.NIM && keyguardResult.nim) {
            const nimHtlcData = confirmedSwap.contracts[SwapAsset.NIM]!.htlc as NimHtlcDetails;
            const nimHtlcByteArray = Nimiq.BufferUtils.fromHex(nimHtlcData.data);

            nimTx = await $nimiqNetwork.createTx(Object.assign({
                signerPubKey: keyguardResult.nim.publicKey,
            }, keyguardResult.nim, this.request.fund, {
                recipient: Nimiq.Address.CONTRACT_CREATION,
                recipientType: Nimiq.Account.Type.HTLC,
                data: nimHtlcByteArray,
                flags: Nimiq.Transaction.Flag.CONTRACT_CREATION,
            }));
        } else if (this.request.redeem.type === SwapAsset.NIM && keyguardResult.nim) {
            const nimHtlcData = confirmedSwap.contracts[SwapAsset.NIM]!.htlc as NimHtlcDetails;
            const nimHtlcByteArray = Nimiq.BufferUtils.fromHex(nimHtlcData.data);

            // FIXME: Enable decoding when HTLC is part of CoreJS web-offline build
            const algorithm = nimHtlcByteArray[20 + 20] as Nimiq.Hash.Algorithm;
            const hashCount = nimHtlcByteArray[20 + 20 + 32 + 1];

            nimTx = await $nimiqNetwork.createTx(Object.assign({
                signerPubKey: keyguardResult.nim.publicKey,
            }, keyguardResult.nim, this.request.redeem, {
                sender: Nimiq.Address.fromUserFriendlyAddress(nimHtlcData.address),
                senderType: Nimiq.Account.Type.HTLC,
            }));

            const preImage = '0000000000000000000000000000000000000000000000000000000000000000';
            const hashRoot = '66687aadf862bd776c8fc18b8e9f8e20089714856ee233b3902a591d0d5f2925'; // SHA256 of preImage

            const proof = new Nimiq.SerialBuffer(3 + 2 * 32 + Nimiq.SignatureProof.SINGLE_SIG_SIZE);
            // FIXME: Use constant when HTLC is part of CoreJS web-offline build
            proof.writeUint8(1 /* Nimiq.HashedTimeLockedContract.ProofType.REGULAR_TRANSFER */);
            proof.writeUint8(algorithm);
            proof.writeUint8(hashCount);
            proof.write(Nimiq.BufferUtils.fromHex(hashRoot));
            proof.write(Nimiq.BufferUtils.fromHex(preImage));
            proof.write(new Nimiq.SerialBuffer(nimTx.proof)); // Current tx.proof is a regular SignatureProof
            nimTx.proof = proof;
        }

        // If we have a Nimiq transaction, validate it (to make sure we are not returning an invalid tx)
        if (nimTx) {
            // FIXME: Enable validation when HTLC is part of CoreJS web-offline build
            // // Validate that transaction is valid
            // if (!nimTx.verify()) {
            //     this.$rpc.reject(new Error('NIM transaction is invalid'));
            //     return;
            // }

            // Validate signature
            const signature = new Nimiq.Signature(keyguardResult.nim!.signature);
            if (!signature.verify(new Nimiq.PublicKey(keyguardResult.nim!.publicKey), nimTx.serializeContent())) {
                this.$rpc.reject(new Error('NIM signature is invalid'));
                return;
            }

            result.nim = await $nimiqNetwork.makeSignTransactionResult(nimTx);
        }

        if (keyguardResult.btc) {
            result.btc = {
                serializedTx: keyguardResult.btc.raw,
                hash: keyguardResult.btc.transactionHash,
            };
        }

        if (typeof keyguardResult.eur === 'string') {
            result.eur = keyguardResult.eur;
        }

        this.$rpc.resolve(result);
    }

    protected get statusScreenState(): StatusScreen.State {
        if (this.state === this.State.FETCHING_SWAP_DATA_FAILED) return StatusScreen.State.ERROR;
        return super.statusScreenState;
    }

    protected get statusScreenTitle() {
        switch (this.state) {
            case this.State.FETCHING_SWAP_DATA_FAILED:
                return this.$t('Fetching Swap Data Failed') as string;
            case this.State.SYNCING_FAILED:
                return this.$t('Syncing Failed') as string;
            default:
                return this.$t('Preparing Swap') as string;
        }
    }

    protected get statusScreenStatus() {
        switch (this.state) {
            case this.State.FETCHING_SWAP_DATA:
                return this.$t('Fetching swap data...') as string;
            case this.State.SIGNING_TRANSACTIONS:
                return this.$t('Signing transactions...') as string;
            default:
                return super.statusScreenStatus;
        }
    }

    protected get statusScreenMessage() {
        if (this.state === this.State.FETCHING_SWAP_DATA_FAILED) {
            return this.$t('Fetching swap data failed: {error}', { error: this.error });
        }
        return super.statusScreenMessage;
    }

    protected get statusScreenAction() {
        if (this.state !== this.State.FETCHING_SWAP_DATA_FAILED
            && this.state !== this.State.SYNCING_FAILED) return '';
        return this.$t('Retry') as string;
    }

    protected get isGlobalCloseShown() {
        return this.state === this.State.FETCHING_SWAP_DATA_FAILED || super.isGlobalCloseShown;
    }
}
</script>
