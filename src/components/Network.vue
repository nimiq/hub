<template>
    <div></div>
</template>

<script lang="ts">
import {Component, Emit, Prop, Watch, Vue} from 'vue-property-decorator';
import {SignTransactionResult, SignTransactionRequest} from '../lib/RequestTypes';
import {
    SignTransactionRequest as KSignTransactionRequest,
    SignTransactionResult as KSignTransactionResult,
} from '@nimiq/keyguard-client';
import {NetworkClient, PlainTransaction} from '@nimiq/network-client';

@Component({components: {}})
export default class Network extends Vue {
    private _networkClient!: NetworkClient;

    // Uint8Arrays cannot be stored in SessionStorage, thus the stored request has arrays instead and is
    // thus not exactly the type KSignTransactionRequest.
    public async prepareTx(
        keyguardRequest: KSignTransactionRequest,
        keyguardResult: KSignTransactionResult,
    ): Promise<Nimiq.Transaction> {
        await this._loadNimiq();

        let tx: Nimiq.Transaction;

        if (
            (keyguardRequest.data && keyguardRequest.data.length > 0)
            || keyguardRequest.senderType !== Nimiq.Account.Type.BASIC
            || keyguardRequest.recipientType !== Nimiq.Account.Type.BASIC
        ) {
            tx = new Nimiq.ExtendedTransaction(
                new Nimiq.Address(new Nimiq.SerialBuffer(keyguardRequest.sender)),
                keyguardRequest.senderType || Nimiq.Account.Type.BASIC,
                new Nimiq.Address(new Nimiq.SerialBuffer(keyguardRequest.recipient)),
                keyguardRequest.recipientType || Nimiq.Account.Type.BASIC,
                keyguardRequest.value,
                keyguardRequest.fee,
                keyguardRequest.validityStartHeight,
                keyguardRequest.flags || 0,
                new Nimiq.SerialBuffer(keyguardRequest.data || 0),
                Nimiq.SignatureProof.singleSig(
                    new Nimiq.PublicKey(keyguardResult.publicKey),
                    new Nimiq.Signature(keyguardResult.signature),
                ).serialize(),
                keyguardRequest.networkId,
            );
        } else {
            tx = new Nimiq.BasicTransaction(
                new Nimiq.PublicKey(keyguardResult.publicKey),
                new Nimiq.Address(new Nimiq.SerialBuffer(keyguardRequest.recipient)),
                keyguardRequest.value,
                keyguardRequest.fee,
                keyguardRequest.validityStartHeight,
                new Nimiq.Signature(keyguardResult.signature),
                keyguardRequest.networkId,
            );
        }

        return tx;
    }

    public makeSignTransactionResult(tx: Nimiq.Transaction) {
        const proof = Nimiq.SignatureProof.unserialize(new Nimiq.SerialBuffer(tx.proof));

        const result: SignTransactionResult = {
            serializedTx: tx.serialize(),

            sender: tx.sender.toUserFriendlyAddress(),
            senderType: tx.senderType,
            senderPubKey: proof.publicKey.serialize(),

            recipient: tx.recipient.toUserFriendlyAddress(),
            recipientType: tx.recipientType,

            value: Nimiq.Policy.satoshisToCoins(tx.value),
            fee: Nimiq.Policy.satoshisToCoins(tx.fee),
            validityStartHeight: tx.validityStartHeight,

            signature: proof.signature.serialize(),

            extraData: tx.data,
            flags: tx.flags,
            networkId: tx.networkId,

            hash: tx.hash().toBase64(),
        };

        return result;
    }

    public async sendToNetwork(tx: Nimiq.Transaction) {
        const txObj = this.makeSignTransactionResult(tx);
        const client = await this._getNetworkClient();

        client.relayTransaction(txObj);

        return new Promise<SignTransactionResult>((resolve, reject) => {
            this.$once('transaction-relayed', (txInfo: any) => {
                if (txInfo.hash === txObj.hash) resolve(txObj);
            });
        });
    }

    public async getBalances(addresses: string[]) {
        const client = await this._getNetworkClient();
        return client.getBalance(addresses);
    }

    private async _getNetworkClient(): Promise<NetworkClient> {
        if (this._networkClient) return this._networkClient;

        this._networkClient = new NetworkClient('http://localhost:5000');
        await this._networkClient.init();

        this._networkClient.on('nimiq-api-ready', () => this.$emit('api-ready'));
        this._networkClient.on('nimiq-consensus-syncing', () => this.$emit('consensus-syncing'));
        this._networkClient.on('nimiq-consensus-established', () => this.$emit('consensus-established'));
        this._networkClient.on('nimiq-consensus-lost', () => this.$emit('consensus-lost'));
        this._networkClient.on('nimiq-balances', (balances: Map<string, number>) => this.$emit('balances', balances));
        this._networkClient.on('nimiq-transaction-pending',
            (txInfo: any) => this.$emit('transaction-pending', txInfo));
        this._networkClient.on('nimiq-transaction-expired', (hash: string) => this.$emit('transaction-expired', hash));
        this._networkClient.on('nimiq-transaction-mined', (txInfo: any) => this.$emit('transaction-mined', txInfo));
        this._networkClient.on('nimiq-transaction-relayed', (txInfo: any) => this.$emit('transaction-relayed', txInfo));
        this._networkClient.on('nimiq-different-tab-error', (e: Error) => this.$emit('different-tab-error', e));
        this._networkClient.on('nimiq-api-fail', (e: Error) => this.$emit('api-fail', e));
        this._networkClient.on('nimiq-head-change',
            (headInfo: {height: number, globalHashrate: number}) => this.$emit('head-change', headInfo));
        this._networkClient.on('nimiq-peer-count', (count: number) => this.$emit('peer-count', count));

        return this._networkClient;
    }

    private async _loadNimiq() {
        try {
            // Load web assembly encryption library into browser (if supported)
            await Nimiq.WasmHelper.doImportBrowser();
            // Configure to use test net for now
            Nimiq.GenesisConfig.test();
        } catch (e) {
            console.error(e);
        }
    }
}
</script>
