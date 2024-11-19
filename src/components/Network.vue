<template></template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import Config from 'config';
import { SignedTransaction } from '../../client/PublicRequestTypes';
import { setHistoryStorage, getHistoryStorage } from '../lib/Helpers';
import { labelVestingContract } from '../lib/LabelingMachine';
import { VestingContractInfo } from '../lib/ContractInfo';
import { NetworkClient } from '../lib/NetworkClient';

@Component
class Network extends Vue {
    private boundListeners: number[] = [];

    public createTx({
        sender,
        senderType = Nimiq.AccountType.Basic,
        senderData,
        recipient,
        recipientType = Nimiq.AccountType.Basic,
        value,
        fee = 0,
        validityStartHeight,
        flags = 0 /* Nimiq.Transaction.Flag.NONE */,
        data,
        signerPubKey,
        signature,
        proofPrefix = new Uint8Array(0),
    }: {
        sender: Nimiq.Address | Uint8Array,
        senderType?: Nimiq.AccountType,
        senderData?: Uint8Array,
        recipient: Nimiq.Address | Uint8Array,
        recipientType?: Nimiq.AccountType,
        value: number,
        fee?: number,
        validityStartHeight: number,
        flags?: number,
        data?: Uint8Array,
        signerPubKey: Nimiq.PublicKey | Uint8Array,
        signature?: Nimiq.Signature | Uint8Array,
        proofPrefix?: Uint8Array,
    }): Nimiq.Transaction {
        if (!(sender instanceof Nimiq.Address)) sender = new Nimiq.Address(sender);
        if (!(recipient instanceof Nimiq.Address)) recipient = new Nimiq.Address(recipient);
        if (!(signerPubKey instanceof Nimiq.PublicKey)) signerPubKey = new Nimiq.PublicKey(signerPubKey);
        if (signature && !(signature instanceof Nimiq.Signature)) signature = Nimiq.Signature.deserialize(signature);

        if (
            (data && data.length > 0)
            || senderType !== Nimiq.AccountType.Basic
            || recipientType !== Nimiq.AccountType.Basic
            || flags !== 0 /* Nimiq.Transaction.Flag.NONE */
        ) {
            let proof: Nimiq.SerialBuffer | undefined;
            if (signature) {
                // 32 publicKey + 1 empty merkle path + 64 signature
                proof = new Nimiq.SerialBuffer(proofPrefix.length + 32 + 1 + 64);
                proof.write(proofPrefix);
                proof.write(Nimiq.SignatureProof.singleSig(signerPubKey, signature).serialize());
            }

            const tx = new Nimiq.Transaction(
                sender,
                // @ts-ignore Staking type not yet supported
                senderType,
                senderData,
                recipient,
                recipientType,
                data || new Uint8Array(0),
                BigInt(value),
                BigInt(fee),
                flags,
                validityStartHeight,
                Config.nimiqNetworkId,
            );
            if (proof) tx.proof = proof;
            return tx;
        } else {
            const tx = Nimiq.TransactionBuilder.newBasic(
                signerPubKey.toAddress(),
                recipient,
                BigInt(value),
                BigInt(fee),
                validityStartHeight,
                Config.nimiqNetworkId,
            );
            if (signature) tx.proof = Nimiq.SignatureProof.singleSig(signerPubKey, signature).serialize();
            return tx;
        }
    }

    public makeSignTransactionResult(tx: Nimiq.Transaction): SignedTransaction {
        const plain = tx.toPlain();

        const signerPublicKeyHex = 'publicKey' in plain.proof
            ? plain.proof.publicKey
            : 'creatorPublicKey' in plain.proof
                ? plain.proof.creatorPublicKey
                : (() => { throw new Error('Unsupported transaction proof'); })();
        const signatureHex = 'signature' in plain.proof
            ? plain.proof.signature
            : 'creatorSignature' in plain.proof
                ? plain.proof.creatorSignature
                : (() => { throw new Error('Unsupported transaction proof'); })();

        const result: SignedTransaction = {
            transaction: tx.serialize(),
            serializedTx: tx.toHex(),
            hash: plain.transactionHash,

            raw: {
                signerPublicKey: Nimiq.BufferUtils.fromHex(signerPublicKeyHex),
                signature: Nimiq.BufferUtils.fromHex(signatureHex),

                sender: tx.sender.toUserFriendlyAddress(),
                senderType: tx.senderType,

                recipient: tx.recipient.toUserFriendlyAddress(),
                recipientType: tx.recipientType,

                value: Number(tx.value),
                fee: Number(tx.fee),
                validityStartHeight: tx.validityStartHeight,

                extraData: tx.data,
                flags: tx.flags,
                networkId: tx.networkId,
                proof: tx.proof,
            },
        };

        return result;
    }

    /**
     * Relays the transaction to the network and only resolves when the network
     * fires its 'transaction-relayed' event for that transaction.
     */
    public async sendToNetwork(tx: Nimiq.Transaction): Promise<SignedTransaction> {
        // Store the transaction in the history state to be able to resend the transaction when the user reloads the
        // window in case it failed to relay it to the network. Not using localstorage or sessionstorage as the
        // transaction should not be broadcast anymore when user closes page, accepting that it failed to send.
        let unrelayedTransactionMap = getHistoryStorage(Network.HISTORY_KEY_UNRELAYED_TRANSACTIONS) || {};
        const base64Hash = Nimiq.BufferUtils.toBase64(Nimiq.BufferUtils.fromHex(tx.hash()));
        unrelayedTransactionMap[base64Hash] = tx.serialize();
        setHistoryStorage(Network.HISTORY_KEY_UNRELAYED_TRANSACTIONS, unrelayedTransactionMap);

        const signedTx = this.makeSignTransactionResult(tx);
        const client = await this.getNetworkClient();

        const txObjToSend = Object.assign({}, signedTx.raw, {
            senderPubKey: signedTx.raw.signerPublicKey,
            value: signedTx.raw.value,
            fee: signedTx.raw.fee,
        });

        const plainTx = await client.relayTransaction(txObjToSend);

        if (plainTx.state === 'expired') {
            throw new Error(Network.Errors.TRANSACTION_EXPIRED);
        }

        if (plainTx.state === 'new') {
            throw new Error(Network.Errors.TRANSACTION_NOT_RELAYED);
        }

        unrelayedTransactionMap = getHistoryStorage(Network.HISTORY_KEY_UNRELAYED_TRANSACTIONS);
        delete unrelayedTransactionMap[base64Hash];
        setHistoryStorage(Network.HISTORY_KEY_UNRELAYED_TRANSACTIONS, unrelayedTransactionMap);

        return signedTx;
    }

    public getUnrelayedTransactions(filter?: {
        sender?: Nimiq.Address,
        senderType?: Nimiq.AccountType,
        recipient?: Nimiq.Address,
        recipientType?: Nimiq.AccountType,
        value?: BigInt,
        fee?: BigInt,
        validityStartHeight?: number,
        flags?: number,
        data?: Uint8Array,
    }): Nimiq.Transaction[] {
        if (!getHistoryStorage(Network.HISTORY_KEY_UNRELAYED_TRANSACTIONS)) return [];
        const serializedTransactions: Uint8Array[]
            = Object.values(getHistoryStorage(Network.HISTORY_KEY_UNRELAYED_TRANSACTIONS));
        const transactions = serializedTransactions.map((serializedTx: Uint8Array) =>
            Nimiq.Transaction.fromAny(serializedTx));
        if (!filter) return transactions;
        return transactions.filter((tx) =>
            (filter.sender === undefined || tx.sender.equals(filter.sender))
            && (filter.senderType === undefined || tx.senderType === filter.senderType)
            && (filter.recipient === undefined || tx.recipient.equals(filter.recipient))
            && (filter.recipientType === undefined || tx.recipientType === filter.recipientType)
            && (filter.value === undefined || tx.value === filter.value)
            && (filter.fee === undefined || tx.fee === filter.fee)
            && (filter.validityStartHeight === undefined || tx.validityStartHeight === filter.validityStartHeight)
            && (filter.flags === undefined || tx.flags === filter.flags)
            && (filter.data === undefined || Nimiq.BufferUtils.equals(tx.data, filter.data)),
        );
    }

    public async getBlockchainHeight(): Promise<number> {
        const client = await this.getNetworkClient();
        return client.getHeight();
    }

    public async getBalances(addresses: string[]): Promise<Map<string, number>> {
        const client = await this.getNetworkClient();
        return client.getBalance(addresses);
    }

    public async getGenesisVestingContracts(): Promise<VestingContractInfo[]> {
        const client = await this.getNetworkClient();
        const contracts = await client.getGenesisVestingContracts();

        return contracts.map((contract) => new VestingContractInfo(
            labelVestingContract(),
            Nimiq.Address.fromString(contract.address),
            Nimiq.Address.fromString(contract.owner),
            contract.startTime,
            contract.stepAmount,
            contract.timeStep,
            contract.totalAmount,
        ));
    }

    public async getNetworkClient(): Promise<NetworkClient> {
        // Make sure the client is initialized
        try {
            await NetworkClient.Instance.init();
            this.$emit(Network.Events.API_READY);
        } catch (error) {
            this.$emit(Network.Events.API_FAIL);
            throw error;
        }

        const client = await NetworkClient.Instance.innerClient;

        if (await client.isConsensusEstablished()) {
            this.$emit(Network.Events.CONSENSUS_ESTABLISHED);
        } else {
            this.$emit(Network.Events.CONSENSUS_SYNCING);
        }
        this.boundListeners.push(await client.addConsensusChangedListener((state) => {
            if (state === 'syncing') this.$emit(Network.Events.CONSENSUS_SYNCING);
            if (state === 'established') this.$emit(Network.Events.CONSENSUS_ESTABLISHED);
        }));

        return NetworkClient.Instance;
    }

    private destroyed() {
        for (const handle of this.boundListeners) {
            NetworkClient.Instance.innerClient.then((client) => client && client.removeListener(handle));
        }
    }
}

namespace Network {
    export const enum Events {
        API_READY = 'api-ready',
        API_FAIL = 'api-fail',
        CONSENSUS_SYNCING = 'consensus-syncing',
        CONSENSUS_ESTABLISHED = 'consensus-established',
        TRANSACTION_PENDING = 'transaction-pending',
        TRANSACTION_RELAYED = 'transaction-relayed',
    }

    export const enum Errors {
        TRANSACTION_EXPIRED = 'Transaction is expired',
        TRANSACTION_NOT_RELAYED = 'Transaction could not be relayed',
    }

    export const HISTORY_KEY_UNRELAYED_TRANSACTIONS = 'network-unrelayed-transactions';
}

export default Network;
</script>
