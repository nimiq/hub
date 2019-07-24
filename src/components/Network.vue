<template></template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';
import { SignedTransaction } from '../lib/PublicRequestTypes';
import { NetworkClient, DetailedPlainTransaction } from '@nimiq/network-client';
import Config from 'config';
import { loadNimiq } from '../lib/Helpers';
import { CONTRACT_DEFAULT_LABEL_VESTING } from '../lib/Constants';
import { VestingContractInfo } from '../lib/ContractInfo';

@Component
class Network extends Vue {
    private static _hasOrSyncsOnTopOfConsensus = false;

    private boundListeners: Array<[NetworkClient.Events, (...args: any[]) => void]> = [];

    public async createTx({
        sender,
        senderType = Nimiq.Account.Type.BASIC,
        recipient,
        recipientType = Nimiq.Account.Type.BASIC,
        value,
        fee = 0,
        validityStartHeight,
        flags = Nimiq.Transaction.Flag.NONE,
        data,
        signerPubKey,
        signature,
    }: {
        sender: Nimiq.Address | Uint8Array,
        senderType?: Nimiq.Account.Type,
        recipient: Nimiq.Address | Uint8Array,
        recipientType?: Nimiq.Account.Type,
        value: number,
        fee?: number,
        validityStartHeight: number,
        flags?: number,
        data?: Uint8Array,
        signerPubKey: Nimiq.PublicKey | Uint8Array,
        signature?: Nimiq.Signature | Uint8Array,
    }): Promise<Nimiq.Transaction> {
        if (!(sender instanceof Nimiq.Address)) sender = new Nimiq.Address(sender);
        if (!(recipient instanceof Nimiq.Address)) recipient = new Nimiq.Address(recipient);
        if (!(signerPubKey instanceof Nimiq.PublicKey)) signerPubKey = new Nimiq.PublicKey(signerPubKey);
        if (signature && !(signature instanceof Nimiq.Signature)) signature = new Nimiq.Signature(signature);

        await loadNimiq();

        if (
            (data && data.length > 0)
            || senderType !== Nimiq.Account.Type.BASIC
            || recipientType !== Nimiq.Account.Type.BASIC
            || flags !== Nimiq.Transaction.Flag.NONE
        ) {
            return new Nimiq.ExtendedTransaction(
                sender,
                senderType,
                recipient,
                recipientType,
                value,
                fee,
                validityStartHeight,
                flags,
                data || new Uint8Array(0),
                signature ? Nimiq.SignatureProof.singleSig(signerPubKey, signature).serialize() : undefined,
            );
        } else {
            return new Nimiq.BasicTransaction(
                signerPubKey,
                recipient,
                value,
                fee,
                validityStartHeight,
                signature,
            );
        }
    }

    public async makeSignTransactionResult(tx: Nimiq.Transaction): Promise<SignedTransaction> {
        await loadNimiq(); // needed for hash computation

        const proof = Nimiq.SignatureProof.unserialize(new Nimiq.SerialBuffer(tx.proof));

        const result: SignedTransaction = {
            serializedTx: Nimiq.BufferUtils.toHex(tx.serialize()),
            hash: tx.hash().toHex(),

            raw: {
                signerPublicKey: proof.publicKey.serialize(),
                signature: proof.signature.serialize(),

                sender: tx.sender.toUserFriendlyAddress(),
                senderType: tx.senderType,

                recipient: tx.recipient.toUserFriendlyAddress(),
                recipientType: tx.recipientType,

                value: tx.value,
                fee: tx.fee,
                validityStartHeight: tx.validityStartHeight,

                extraData: tx.data,
                flags: tx.flags,
                networkId: tx.networkId,
            },
        };

        return result;
    }

    /**
     * Relays the transaction to the network and only resolves when the network
     * fires its 'transaction-relayed' event for that transaction.
     */
    public async sendToNetwork(tx: Nimiq.Transaction): Promise<SignedTransaction> {
        const signedTx = await this.makeSignTransactionResult(tx);
        const client = await this._getNetworkClient();

        const txObjToSend = Object.assign({}, signedTx.raw, {
            senderPubKey: signedTx.raw.signerPublicKey,
            value: Nimiq.Policy.satoshisToCoins(signedTx.raw.value),
            fee: Nimiq.Policy.satoshisToCoins(signedTx.raw.fee),
        });
        client.relayTransaction(txObjToSend);

        return new Promise<SignedTransaction>((resolve, reject) => {
            const base64Hash = Nimiq.BufferUtils.toBase64(Nimiq.BufferUtils.fromHex(signedTx.hash));
            this.$once('transaction-relayed', (txInfo: any) => {
                if (txInfo.hash === base64Hash) resolve(signedTx);
            });
        });
    }

    public async getBlockchainHeight(): Promise<number> {
        const client = await this._getNetworkClient();
        if (Network._hasOrSyncsOnTopOfConsensus) return client.headInfo.height;
        return new Promise((resolve) => this.$once(Network.Events.CONSENSUS_ESTABLISHED,
            () => resolve(client.headInfo.height)));
    }

    public async getBalances(addresses: string[]): Promise<Map<string, number>> {
        const client = await this._getNetworkClient();
        return client.getBalance(addresses);
    }

    public async requestTransactionReceipts(address: string): Promise<Nimiq.TransactionReceipt[]> {
        const client = await this._getNetworkClient();
        return client.requestTransactionReceipts(address);
    }

    public async getGenesisVestingContracts(): Promise<VestingContractInfo[]> {
        const client = await this._getNetworkClient();
        const contracts = await client.getGenesisVestingContracts();

        return contracts.map((contract) => new VestingContractInfo(
            CONTRACT_DEFAULT_LABEL_VESTING,
            Nimiq.Address.fromUserFriendlyAddress(contract.address),
            Nimiq.Address.fromUserFriendlyAddress(contract.owner),
            contract.start,
            Nimiq.Policy.coinsToSatoshis(contract.stepAmount),
            contract.stepBlocks,
            Nimiq.Policy.coinsToSatoshis(contract.totalAmount),
        ));
    }

    private created() {
        this.$on(Network.Events.CONSENSUS_ESTABLISHED, () => {
            Network._hasOrSyncsOnTopOfConsensus = true;
        });
        this.$on(Network.Events.CONSENSUS_LOST, () => {
            Network._hasOrSyncsOnTopOfConsensus = false;
        });
    }

    private destroyed() {
        if (!NetworkClient.hasInstance()) return;
        for (const [event, listener] of this.boundListeners) {
            NetworkClient.Instance.off(event, listener);
        }
    }

    private async _getNetworkClient(): Promise<NetworkClient> {
        if (!NetworkClient.hasInstance()) {
            NetworkClient.createInstance(Config.networkEndpoint);
        }
        // Make sure the client is initialized
        await NetworkClient.Instance.init();

        if (this.boundListeners.length === 0) {
            this._registerNetworkListener(NetworkClient.Events.API_READY,
                () => this.$emit(Network.Events.API_READY));
            this._registerNetworkListener(NetworkClient.Events.API_FAIL,
                (e: Error) => this.$emit(Network.Events.API_FAIL, e));
            this._registerNetworkListener(NetworkClient.Events.CONSENSUS_SYNCING,
                () => this.$emit(Network.Events.CONSENSUS_SYNCING));
            this._registerNetworkListener(NetworkClient.Events.CONSENSUS_ESTABLISHED,
                () => this.$emit(Network.Events.CONSENSUS_ESTABLISHED));
            this._registerNetworkListener(NetworkClient.Events.CONSENSUS_LOST,
                () => this.$emit(Network.Events.CONSENSUS_LOST));
            this._registerNetworkListener(NetworkClient.Events.PEERS_CHANGED,
                (count: number) => this.$emit(Network.Events.PEERS_CHANGED, count));
            this._registerNetworkListener(NetworkClient.Events.BALANCES_CHANGED,
                (balances: Map<string, number>) => this.$emit(Network.Events.BALANCES_CHANGED, balances));
            this._registerNetworkListener(NetworkClient.Events.TRANSACTION_PENDING,
                (txInfo: Partial<DetailedPlainTransaction>) => this.$emit(Network.Events.TRANSACTION_PENDING, txInfo));
            this._registerNetworkListener(NetworkClient.Events.TRANSACTION_EXPIRED,
                (hash: string) => this.$emit(Network.Events.TRANSACTION_EXPIRED, hash));
            this._registerNetworkListener(NetworkClient.Events.TRANSACTION_MINED,
                (txInfo: DetailedPlainTransaction) => this.$emit(Network.Events.TRANSACTION_MINED, txInfo));
            this._registerNetworkListener(NetworkClient.Events.TRANSACTION_RELAYED,
                (txInfo: Partial<DetailedPlainTransaction>) => this.$emit(Network.Events.TRANSACTION_RELAYED, txInfo));
            this._registerNetworkListener(NetworkClient.Events.HEAD_CHANGE,
                (headInfo: {height: number, globalHashrate: number}) =>
                    this.$emit(Network.Events.HEAD_CHANGE, headInfo));

            this._fireInitialEvents();
        }

        return NetworkClient.Instance;
    }

    private _registerNetworkListener(event: NetworkClient.Events, listener: (...args: any[]) => void) {
        if (!NetworkClient.hasInstance()) console.warn('Using default instance with default endpoint.');
        NetworkClient.Instance.on(event, listener);
        this.boundListeners.push([event, listener]);
    }

    private _fireInitialEvents() {
        if (!NetworkClient.hasInstance()) return;
        const networkClient = NetworkClient.Instance;
        if (networkClient.apiLoadingState === 'ready') this.$emit(Network.Events.API_READY);
        else if (networkClient.apiLoadingState === 'failed') this.$emit(Network.Events.API_FAIL);

        if (networkClient.consensusState === 'syncing') this.$emit(Network.Events.CONSENSUS_SYNCING);
        else if (networkClient.consensusState === 'established') this.$emit(Network.Events.CONSENSUS_ESTABLISHED);
        else if (networkClient.consensusState === 'lost') this.$emit(Network.Events.CONSENSUS_LOST);
        Network._hasOrSyncsOnTopOfConsensus = Network._hasOrSyncsOnTopOfConsensus
            || networkClient.consensusState === 'established';

        if (networkClient.peerCount !== 0) this.$emit(Network.Events.PEERS_CHANGED, networkClient.peerCount);

        if (networkClient.balances.size !== 0) this.$emit(Network.Events.BALANCES_CHANGED, networkClient.balances);

        for (const tx of networkClient.pendingTransactions) this.$emit(Network.Events.TRANSACTION_PENDING, tx);
        for (const txHash of networkClient.expiredTransactions) this.$emit(Network.Events.TRANSACTION_EXPIRED, txHash);
        for (const tx of networkClient.minedTransactions) this.$emit(Network.Events.TRANSACTION_MINED, tx);
        for (const tx of networkClient.relayedTransactions) this.$emit(Network.Events.TRANSACTION_RELAYED, tx);

        if (networkClient.headInfo.height !== 0) this.$emit(Network.Events.HEAD_CHANGE, networkClient.headInfo);
    }
}

namespace Network { // tslint:disable-line:no-namespace
    export const enum Events {
        API_READY = 'api-ready',
        API_FAIL = 'api-fail',
        CONSENSUS_SYNCING = 'consensus-syncing',
        CONSENSUS_ESTABLISHED = 'consensus-established',
        CONSENSUS_LOST = 'consensus-lost',
        PEERS_CHANGED = 'peer-count',
        BALANCES_CHANGED = 'balances',
        TRANSACTION_PENDING = 'transaction-pending',
        TRANSACTION_EXPIRED = 'transaction-expired',
        TRANSACTION_MINED = 'transaction-mined',
        TRANSACTION_RELAYED = 'transaction-relayed',
        HEAD_CHANGE = 'head-change',
    }
}

export default Network;
</script>
