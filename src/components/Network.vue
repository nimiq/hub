<template>
    <div class="network loading" :class="!visible || consensusEstablished ? 'hidden' : ''">
        <div class="loading-animation"></div>
        <div class="loading-status">{{ status }}</div>
    </div>
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
    @Prop(Boolean) private visible?: boolean;
    @Prop(String) private message?: string;

    private _networkClient!: NetworkClient;
    private consensusEstablished: boolean = false;

    public async connect() {
        // Load network iframe and autoconnect
        await this._getNetworkClient();
    }

    // Uint8Arrays cannot be stored in SessionStorage, thus the stored request has arrays instead and is
    // thus not exactly the type KSignTransactionRequest. Thus all potential Uint8Arrays are converted
    // into Nimiq.SerialBuffers (sender, recipient, data).
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

    /**
     * The result of this method can also be used as a PlainTransaction
     * for all relevant nano-api methods.
     */
    public makeSignTransactionResult(tx: Nimiq.Transaction): SignTransactionResult {
        const proof = Nimiq.SignatureProof.unserialize(new Nimiq.SerialBuffer(tx.proof));

        const result: SignTransactionResult = {
            serializedTx: tx.serialize(),

            sender: tx.sender.toUserFriendlyAddress(),
            senderType: tx.senderType,
            senderPubKey: proof.publicKey.serialize(),

            recipient: tx.recipient.toUserFriendlyAddress(),
            recipientType: tx.recipientType,

            value: tx.value,
            fee: tx.fee,
            validityStartHeight: tx.validityStartHeight,

            signature: proof.signature.serialize(),

            extraData: tx.data,
            flags: tx.flags,
            networkId: tx.networkId,

            hash: tx.hash().toBase64(),
        };

        return result;
    }

    /**
     * Relays the transaction to the network and only resolves when the network
     * fires its 'transaction-relayed' event for that transaction.
     */
    public async sendToNetwork(tx: Nimiq.Transaction): Promise<SignTransactionResult> {
        const txObj = this.makeSignTransactionResult(tx);
        const client = await this._getNetworkClient();

        const txObjToSend = Object.assign({}, txObj, {
            value: Nimiq.Policy.satoshisToCoins(txObj.value),
            fee: Nimiq.Policy.satoshisToCoins(txObj.fee),
        });
        client.relayTransaction(txObjToSend);

        return new Promise<SignTransactionResult>((resolve, reject) => {
            this.$once('transaction-relayed', (txInfo: any) => {
                if (txInfo.hash === txObj.hash) resolve(txObj);
            });
        });
    }

    public async getBalances(addresses: string[]): Promise<Map<string, number>> {
        const client = await this._getNetworkClient();
        return client.getBalance(addresses);
    }

    private created() {
        this.$on('consensus-established', () => this.consensusEstablished = true);
        this.$on('consensus-lost', () => this.consensusEstablished = false);
    }

    private async _getNetworkClient(): Promise<NetworkClient> {
        if (this._networkClient) return this._networkClient;

        this._networkClient = new NetworkClient('https://network-next.nimiq-testnet.com');
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

    private get status(): string {
        return this.message || 'Establishing consensus';
    }
}
</script>

<style scoped>
    .network {
        width: 100%;
        height: 20rem;
        background: #724ceb;
        color: white;
        border-radius: 0.5rem;
        flex-shrink: 0;
        padding: 3rem;
        box-sizing: border-box;
    }

    .network.hidden {
        display: none;
    }

    .loading {
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .loading-status {
        margin-top: 2rem;
    }

    .loading-animation {
        opacity: 1;
        background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCIgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0Ij48c3R5bGU+QGtleWZyYW1lcyBkYXNoLWFuaW1hdGlvbiB7IHRvIHsgdHJhbnNmb3JtOiByb3RhdGUoMjQwZGVnKSB0cmFuc2xhdGVaKDApOyB9IH0gI2NpcmNsZSB7IGFuaW1hdGlvbjogM3MgZGFzaC1hbmltYXRpb24gaW5maW5pdGUgbGluZWFyOyB0cmFuc2Zvcm06IHJvdGF0ZSgtMTIwZGVnKSB0cmFuc2xhdGVaKDApOyB0cmFuc2Zvcm0tb3JpZ2luOiBjZW50ZXI7IH08L3N0eWxlPjxkZWZzPjxjbGlwUGF0aCBpZD0iaGV4Q2xpcCI+PHBhdGggY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNMTYgNC4yOWgzMkw2NCAzMiA0OCA1OS43MUgxNkwwIDMyem00LjYyIDhoMjIuNzZMNTQuNzYgMzIgNDMuMzggNTEuNzFIMjAuNjJMOS4yNCAzMnoiLz48L2NsaXBQYXRoPjwvZGVmcz48cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xNiA0LjI5aDMyTDY0IDMyIDQ4IDU5LjcxSDE2TDAgMzJ6bTQuNjIgOGgyMi43Nkw1NC43NiAzMiA0My4zOCA1MS43MUgyMC42Mkw5LjI0IDMyeiIgZmlsbD0iI2ZmZiIgb3BhY2l0eT0iLjIiLz48ZyBjbGlwLXBhdGg9InVybCgjaGV4Q2xpcCkiPjxjaXJjbGUgaWQ9ImNpcmNsZSIgY3g9IjMyIiBjeT0iMzIiIHI9IjE2IiBmaWxsPSJub25lIiBzdHJva2Utd2lkdGg9IjMyIiBzdHJva2U9IiNGNkFFMkQiIHN0cm9rZS1kYXNoYXJyYXk9IjE2LjY2NiA4NC42NjYiLz48L2c+PC9zdmc+');
        background-repeat: no-repeat;
        background-position: center;
        background-size: 100%;
        z-index: 1;
        display: block;
        height: 10rem;
        width: 10rem;
    }
</style>
