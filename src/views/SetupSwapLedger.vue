<script lang="ts">
import { Component, Mixins } from 'vue-property-decorator';
import { Getter } from 'vuex-class';
import SetupSwap, { SwapSetupInfo } from './SetupSwap.vue';
import SetupSwapSuccess, { SwapHtlcInfo } from './SetupSwapSuccess.vue';
import Network from '../components/Network.vue';
import LedgerApi, {
    RequestTypeNimiq as LedgerApiRequestTypeNimiq,
    RequestTypeBitcoin as LedgerApiRequestTypeBitcoin,
    TransactionInfoNimiq as LedgerNimiqTransactionInfo,
    TransactionInfoBitcoin as LedgerBitcoinTransactionInfo,
    getBip32Path,
    Coin,
} from '@nimiq/ledger-api';
import Config from 'config';
import { SignedBtcTransaction } from '../lib/PublicRequestTypes';
import { WalletInfo } from '../lib/WalletInfo';
import { ERROR_CANCELED } from '../lib/Constants';
import { BTC_NETWORK_TEST } from '../lib/bitcoin/BitcoinConstants';
import { loadBitcoinJS } from '../lib/bitcoin/BitcoinJSLoader';
import { getElectrumClient } from '../lib/bitcoin/ElectrumClient';
import { SwapAsset } from '@nimiq/fastspot-api';
import { prepareBitcoinTransactionForLedgerSigning } from '../lib/bitcoin/BitcoinLedgerUtils';

// As the Ledger Nimiq app currently does not support signing HTLCs yet, we use a key derived from the Ledger Nimiq
// public key at LEDGER_HTLC_PROXY_KEY_PATH as a proxy for signing the HTLC. Note that 2 ** 31 - 1 is the max index
// allowed by bip32.
export const LEDGER_HTLC_PROXY_KEY_PATH = getBip32Path({
    coin: Coin.NIMIQ,
    accountIndex: 2 ** 31 - 1,
    addressIndex: 2 ** 31 - 1,
});

const ProxyExtraData = {
    // HTLC Proxy Funding, abbreviated as 'HPFD', mapped to values outside of basic ascii range
    FUND:  new Uint8Array([0, ...('HPFD'.split('').map((c) => c.charCodeAt(0) + 63))]),
    // HTLC Proxy Redeeming, abbreviated as 'HPRD', mapped to values outside of basic ascii range
    REDEEM: new Uint8Array([0, ...('HPRD'.split('').map((c) => c.charCodeAt(0) + 63))]),
};

@Component
export default class SetupSwapLedger extends Mixins(SetupSwap, SetupSwapSuccess) {
    @Getter protected findWallet!: (id: string) => WalletInfo | undefined;
    protected _account!: WalletInfo;
    private _setupSwapPromise!: Promise<SwapSetupInfo>;
    private _nimiqProxyKeyPromise!: Promise<Nimiq.KeyPair>;
    private _nimiqLedgerAddress!: Nimiq.Address;

    protected async created() {
        // preload BitcoinJS and the electrum client used in prepareBitcoinTransactionForLedgerSigning
        Promise.all([
            loadBitcoinJS(),
            getElectrumClient(),
        ]).catch(() => void 0);

        this._setupSwapPromise = new Promise((resolve) => this._setupSwap = resolve);

        if ((this.request.fund.type !== SwapAsset.NIM && this.request.fund.type !== SwapAsset.BTC)
            || (this.request.redeem.type !== SwapAsset.NIM && this.request.redeem.type !== SwapAsset.BTC)) {
            const error = new Error('Fiat swaps currently not supported for Ledgers');
            this.$rpc.reject(error);
            throw error;
        }

        // As the Ledger Nimiq app currently does not support signing HTLCs yet, we use a proxy in-memory key.
        // This key gets derived from the Ledger public key at LEDGER_HTLC_PROXY_KEY_PATH as entropy.

        this._nimiqLedgerAddress = this.request.fund.type === SwapAsset.NIM
            ? this.request.fund.sender
            : this.request.redeem.type === SwapAsset.NIM
                ? this.request.redeem.recipient
                : (() => { throw new Error('Swap does not contain a NIM address'); })();
        // existence checked by _hubApiHandler in RpcApi
        this._account = this.findWallet(this.request.walletId)!;

        this._nimiqProxyKeyPromise = (async () => {
            const pubKeyAsEntropy = await LedgerApi.Nimiq.getPublicKey(LEDGER_HTLC_PROXY_KEY_PATH, this._account.keyId);
            const nimProxyKey = Nimiq.KeyPair.derive(new Nimiq.PrivateKey(pubKeyAsEntropy.serialize()));

            // Replace nim address by the proxy's address. Don't replace request.nimiqAddresses which should contain the
            // original address for display.
            const proxyAddress = nimProxyKey.publicKey.toAddress();
            if (this.request.fund.type === SwapAsset.NIM) {
                this.request.fund.sender = proxyAddress;
            } else if (this.request.redeem.type === SwapAsset.NIM) {
                this.request.redeem.recipient = proxyAddress;
            }

            return nimProxyKey;
        })();
        // Catch errors to avoid uncaught promise rejections but ignore them and just keep errors displayed in LedgerUi.
        this._nimiqProxyKeyPromise.catch(() => void 0);
    }

    protected destroyed() {
        this._isDestroyed = true;
        LedgerApi.disconnect(
            /* cancelRequest */ true,
            /* requestTypesToDisconnect */ [
                LedgerApiRequestTypeNimiq.GET_PUBLIC_KEY,
                LedgerApiRequestTypeNimiq.SIGN_TRANSACTION,
                LedgerApiRequestTypeBitcoin.SIGN_TRANSACTION,
            ],
        );
    }

    protected async _collectSwapSetupInfo(): Promise<SwapSetupInfo | null> {
        // super._collectSwapSetupInfo doesn't work
        const swapSetupInfo = await (this.constructor as any).superOptions.methods._collectSwapSetupInfo.call(this);
        if (!swapSetupInfo) return null;

        // Replace nim address by the proxy's address.
        let nimProxyKey: Nimiq.KeyPair;
        try {
            nimProxyKey = await this._nimiqProxyKeyPromise;
        } catch (e) {
            return null;
        }
        const proxyAddress = nimProxyKey.publicKey.toAddress().serialize();
        if (swapSetupInfo.fund.type === SwapAsset.NIM) {
            swapSetupInfo.fund.sender = proxyAddress;
            swapSetupInfo.fund.senderType = Nimiq.Account.Type.BASIC;
        } else if (swapSetupInfo.redeem.type === SwapAsset.NIM) {
            swapSetupInfo.redeem.recipient = proxyAddress;
        }

        return swapSetupInfo;
    }

    protected async _shouldConfirmSwap() {
        if (this._isDestroyed) return false;
        try {
            await Promise.all([
                // await first step of swap setup
                this._setupSwapPromise,
                // This requires the user to connect and unlock his ledger which also shows that the user intends to
                // actually do the swap.
                this._nimiqProxyKeyPromise,
            ]);
        } catch (e) {
            return false;
        }
        return !this._isDestroyed;
    }

    protected async _signSwapTransactions(htlcInfo: SwapHtlcInfo)
        : Promise<{ nim: Nimiq.Transaction, nimProxy: Nimiq.Transaction, btc: SignedBtcTransaction } | null> {
        if (this._isDestroyed) return null;
        let swapSetupInfo: SwapSetupInfo;
        let nimiqProxyKey: Nimiq.KeyPair;
        let Buffer: typeof import('buffer').Buffer;
        try {
            [swapSetupInfo, nimiqProxyKey] = await Promise.all([
                this._setupSwapPromise,
                this._nimiqProxyKeyPromise,
                loadBitcoinJS(),
            ]);
            // note that buffer is marked as external module in vue.config.js and internally, the buffer bundled with
            // BitcoinJS is used, therefore we retrieve it after having BitcoinJS loaded.
            // TODO change this when we don't prebuild BitcoinJS anymore
            Buffer = await import('buffer').then((module) => module.Buffer);
        } catch (e) {
            return null;
        }

        if (this._isDestroyed) return null;

        // Collect nimiq swap transaction info

        let nimiqSwapTransactionInfo: Parameters<Network['createTx']>[0]; // currently signed by proxy, not Ledger
        let nimiqProxyTransactionInfo: LedgerNimiqTransactionInfo & Parameters<Network['createTx']>[0];
        if (this.request.fund.type === SwapAsset.NIM
            && swapSetupInfo.fund.type === SwapAsset.NIM
            && htlcInfo.fund.type === SwapAsset.NIM) {
            nimiqSwapTransactionInfo = {
                signerPubKey: nimiqProxyKey.publicKey,
                sender: new Nimiq.Address(swapSetupInfo.fund.sender),
                senderType: swapSetupInfo.fund.senderType,
                recipient: Nimiq.Address.CONTRACT_CREATION, // htlc creation
                recipientType: Nimiq.Account.Type.HTLC,
                value: swapSetupInfo.fund.value,
                fee: swapSetupInfo.fund.fee,
                validityStartHeight: swapSetupInfo.fund.validityStartHeight,
                // network: Config.network, // enable when signed by Ledger
                flags: Nimiq.Transaction.Flag.CONTRACT_CREATION,
                data: htlcInfo.fund.htlcData, // for proxy via createTx and getUnrelayedTransactions
                // extraData: htlcInfo.fund.htlcData, // for LedgerApi; unset as Ledger does not sign this tx currently
            };
            // funding tx from Ledger to proxy address
            nimiqProxyTransactionInfo = {
                signerPubKey: nimiqProxyKey.publicKey,
                sender: this._nimiqLedgerAddress,
                recipient: nimiqProxyKey.publicKey.toAddress(),
                value: swapSetupInfo.fund.value,
                validityStartHeight: swapSetupInfo.fund.validityStartHeight,
                network: Config.network,
                // data: ProxyExtraData.FUND, // for createTx and getUnrelayedTransactions; unset as signed by Ledger
                extraData: ProxyExtraData.FUND, // for LedgerApi
            };
        } else if (this.request.redeem.type === SwapAsset.NIM
            && swapSetupInfo.redeem.type === SwapAsset.NIM
            && htlcInfo.redeem.type === SwapAsset.NIM) {
            nimiqSwapTransactionInfo = {
                signerPubKey: nimiqProxyKey.publicKey,
                sender: Nimiq.Address.fromString(htlcInfo.redeem.htlcAddress),
                senderType: Nimiq.Account.Type.HTLC,
                recipient: new Nimiq.Address(swapSetupInfo.redeem.recipient),
                value: swapSetupInfo.redeem.value,
                fee: swapSetupInfo.redeem.fee,
                validityStartHeight: swapSetupInfo.redeem.validityStartHeight,
                // network: Config.network, // enable when signed by Ledger
            };
            // redeeming tx from proxy address to Ledger
            nimiqProxyTransactionInfo = {
                signerPubKey: nimiqProxyKey.publicKey,
                sender: nimiqProxyKey.publicKey.toAddress(),
                recipient: this._nimiqLedgerAddress,
                value: swapSetupInfo.redeem.value,
                validityStartHeight: swapSetupInfo.redeem.validityStartHeight,
                network: Config.network,
                data: ProxyExtraData.REDEEM, // for createTx and getUnrelayedTransactions
                // extraData: ProxyExtraData.REDEEM, // for LedgerApi; unset as Ledger only signs this as a dummy tx
            };
        } else {
            throw new Error('Could not find NIM transaction data');
        }

        // Collect bitcoin swap transaction info

        let bitcoinTransactionInfo: Parameters<typeof prepareBitcoinTransactionForLedgerSigning>[0];
        const bitcoinNetwork = Config.bitcoinNetwork === BTC_NETWORK_TEST
            ? BitcoinJS.networks.testnet
            : BitcoinJS.networks.bitcoin;
        if (this.request.fund.type === SwapAsset.BTC
            && swapSetupInfo.fund.type === SwapAsset.BTC
            && htlcInfo.fund.type === SwapAsset.BTC) {
            const htlcAddress = BitcoinJS.payments.p2wsh({
                witness: [Buffer.from(htlcInfo.fund.htlcScript)],
                network: bitcoinNetwork,
            }).address;

            if (!htlcAddress) {
                throw new Error('Cannot derive HTLC address from BTC HTLC script');
            }

            bitcoinTransactionInfo = {
                inputs: swapSetupInfo.fund.inputs,
                recipientOutput: {
                    ...swapSetupInfo.fund.recipientOutput,
                    address: htlcAddress,
                },
                ...(this.request.fund.changeOutput && swapSetupInfo.fund.changeOutput ? {
                    changeOutput: {
                        ...swapSetupInfo.fund.changeOutput,
                        address: this.request.fund.changeOutput.address,
                    },
                } : {}),
            };
        } else if (this.request.redeem.type === SwapAsset.BTC
            && swapSetupInfo.redeem.type === SwapAsset.BTC
            && htlcInfo.redeem.type === SwapAsset.BTC) {
            bitcoinTransactionInfo = {
                inputs: [{ // the htlc is our single input
                    keyPath: swapSetupInfo.redeem.input.keyPath,
                    transactionHash: htlcInfo.redeem.transactionHash,
                    outputIndex: htlcInfo.redeem.outputIndex,
                    customScript: Nimiq.BufferUtils.toHex(htlcInfo.redeem.htlcScript),
                }],
                recipientOutput: {
                    ...swapSetupInfo.redeem.output,
                    address: this.request.redeem.output.address,
                },
                // no change output
            };
        } else {
            throw new Error('Could not find BTC transaction data');
        }

        // prepare btc transaction for ledger signing
        const preparedBitcoinTransactionInfoPromise = prepareBitcoinTransactionForLedgerSigning(bitcoinTransactionInfo);

        // sign transactions

        let signedNimiqSwapTransaction: Nimiq.Transaction;
        let signedNimiqProxyTransaction: Nimiq.Transaction;
        let nimiqSendPromise: Promise<any> = Promise.resolve();
        let signedBitcoinTransactionHex: string;
        try {
            if (this._isDestroyed) return null;

            // First sign Nim transaction as user is already connected to nimiq app and to give time for proxy funding

            if (swapSetupInfo.fund.type === SwapAsset.NIM) {
                // send funding tx from Ledger to proxy address
                signedNimiqProxyTransaction = this.nimiqNetwork.getUnrelayedTransactions(nimiqProxyTransactionInfo)[0];
                if (!signedNimiqProxyTransaction) {
                    signedNimiqProxyTransaction = await LedgerApi.Nimiq.signTransaction(
                        nimiqProxyTransactionInfo,
                        this._account.findSignerForAddress(this._nimiqLedgerAddress)!.path,
                        this._account.keyId,
                    );
                }
                // ignore broadcast errors. The Wallet will also try to send the tx
                nimiqSendPromise = this.nimiqNetwork.sendToNetwork(signedNimiqProxyTransaction).catch(() => void 0);
            } else if (swapSetupInfo.redeem.type === SwapAsset.NIM) {
                // For redeeming, both the htlc swap transaction as well as the proxy transaction are signed by the
                // proxy. Nonetheless, we let the user sign an unused dummy transaction for ux consistency. This
                // transaction is signed from a keyPath which does not actually hold funds.
                await LedgerApi.Nimiq.signTransaction(
                    nimiqProxyTransactionInfo,
                    // Any unused key path; We use LEDGER_HTLC_PROXY_KEY_PATH here but note that this is different from
                    // the proxy account as the proxy account is derived from the public key. Also note that this signed
                    // tx should not be exposed to not expose the public key.
                    LEDGER_HTLC_PROXY_KEY_PATH,
                    this._account.keyId,
                );
                // Sign actual proxy transaction. Don't broadcast the transaction yet, other than in funding case as the
                // funds are only available after the htlc has been redeemed with the htlc secret.
                signedNimiqProxyTransaction = await this.nimiqNetwork.createTx(nimiqProxyTransactionInfo);
                signedNimiqProxyTransaction.proof = Nimiq.SignatureProof.singleSig(
                    nimiqProxyKey.publicKey,
                    Nimiq.Signature.create(
                        nimiqProxyKey.privateKey,
                        nimiqProxyKey.publicKey,
                        signedNimiqProxyTransaction.serializeContent(),
                    ),
                ).serialize();
            } else {
                throw new Error('Could not find NIM transaction data');
            }

            signedNimiqSwapTransaction = await this.nimiqNetwork.createTx({
                ...nimiqSwapTransactionInfo,
                signerPubKey: nimiqProxyKey.publicKey,
            });
            signedNimiqSwapTransaction.proof = Nimiq.SignatureProof.singleSig(
                nimiqProxyKey.publicKey,
                Nimiq.Signature.create(
                    nimiqProxyKey.privateKey,
                    nimiqProxyKey.publicKey,
                    signedNimiqSwapTransaction.serializeContent(),
                ),
            ).serialize();

            if (this._isDestroyed) return null;

            // Then sign the Btc transaction

            let preparedBitcoinTransactionInfo: LedgerBitcoinTransactionInfo;
            try {
                preparedBitcoinTransactionInfo = await preparedBitcoinTransactionInfoPromise;
            } catch (e) {
                this.error = e.message || e;
                return null;
            }

            signedBitcoinTransactionHex = await LedgerApi.Bitcoin.signTransaction(preparedBitcoinTransactionInfo);
        } catch (e) {
            // If cancelled reject. Otherwise just keep the ledger ui / error message displayed.
            if (e.message.toLowerCase().indexOf('cancelled') !== -1) throw new Error(ERROR_CANCELED);
            return null;
        }
        const signedBitcoinTransaction = BitcoinJS.Transaction.fromHex(signedBitcoinTransactionHex);

        // set htlc witness for redeeming the BTC htlc. For Nimiq, the htlc proof is set in SetupSwapSuccess.

        if (swapSetupInfo.redeem.type === SwapAsset.BTC && htlcInfo.redeem.type === SwapAsset.BTC) {
            const htlcInput = signedBitcoinTransaction.ins[0];
            // get signature and signer pub key from default witness generated by ledgerjs (see @ledgerhq/hw-app-btc
            // createTransaction.js creation of the witness towards the end of createTransaction)
            const [inputSignature, signerPubKey] = htlcInput.witness;

            const witnessBytes = BitcoinJS.script.fromASM([
                inputSignature.toString('hex'),
                signerPubKey.toString('hex'),
                // Use zero-bytes as a dummy secret which are replaced in the wallet once the swap secret is known
                '0000000000000000000000000000000000000000000000000000000000000000',
                'OP_1', // OP_1 (true) activates the redeem branch in the HTLC script
                Nimiq.BufferUtils.toHex(htlcInfo.redeem.htlcScript),
            ].join(' '));

            const witnessStack = BitcoinJS.script.toStack(witnessBytes);
            signedBitcoinTransaction.setWitness(0, witnessStack);
        }

        await nimiqSendPromise;

        return {
            nim: signedNimiqSwapTransaction,
            nimProxy: signedNimiqProxyTransaction,
            btc: {
                serializedTx: signedBitcoinTransaction.toHex(),
                hash: signedBitcoinTransaction.getId(),
            },
        };
    }
}
</script>
