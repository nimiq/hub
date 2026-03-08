<template></template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { SignedTransaction } from '../../client/PublicRequestTypes';
import { State } from 'vuex-class';
import KeyguardClient from '@nimiq/keyguard-client';

// Type guard to check if result is an array
function isMultiTransactionResult(
    result: KeyguardClient.SignTransactionResult | KeyguardClient.SignTransactionResult[],
): result is KeyguardClient.SignTransactionResult[] {
    return Array.isArray(result);
}

function convertToSignedTransaction(txResult: KeyguardClient.SignTransactionResult): SignedTransaction {
    const hex = Nimiq.BufferUtils.toHex(txResult.serializedTx);
    const tx = Nimiq.Transaction.fromAny(hex);

    try {
        const plain = tx.toPlain();

        return {
            transaction: txResult.serializedTx,
            serializedTx: hex,
            hash: plain.transactionHash,
            raw: {
                ...plain,
                senderType: tx.senderType,
                recipientType: tx.recipientType,
                proof: tx.proof,
                signerPublicKey: 'publicKey' in plain.proof
                    ? Nimiq.BufferUtils.fromHex(plain.proof.publicKey)
                    : 'creatorPublicKey' in plain.proof
                        ? Nimiq.BufferUtils.fromHex(plain.proof.creatorPublicKey)
                        : new Uint8Array(0),
                signature: 'signature' in plain.proof
                    ? Nimiq.BufferUtils.fromHex(plain.proof.signature)
                    : 'creatorSignature' in plain.proof
                        ? Nimiq.BufferUtils.fromHex(plain.proof.creatorSignature)
                        : new Uint8Array(0),
                extraData: tx.data,
                networkId: tx.networkId,
            },
        };
    } catch (error) {
        // Handle case where toPlain() fails (e.g., for demo/invalid transactions)
        // Still return the signed transaction data even if we can't parse all details
        console.warn('Failed to parse transaction details:', error);
        return {
            transaction: txResult.serializedTx,
            serializedTx: hex,
            hash: '', // Will be empty for invalid transactions
            raw: {
                sender: '',
                senderType: tx.senderType,
                recipient: '',
                recipientType: tx.recipientType,
                value: 0,
                fee: 0,
                validityStartHeight: 0,
                networkId: 0,
                flags: 0,
                proof: tx.proof,
                signerPublicKey: new Uint8Array(0),
                signature: new Uint8Array(0),
                extraData: tx.data,
            },
        };
    }
}

@Component({})
export default class SignTransactionSuccess extends Vue {
    @State private keyguardResult!: KeyguardClient.SignTransactionResult | KeyguardClient.SignTransactionResult[];

    private mounted() {
        // Handle both single and multi-transaction results
        if (isMultiTransactionResult(this.keyguardResult)) {
            // Multi-transaction result
            const results: SignedTransaction[] = this.keyguardResult.map(convertToSignedTransaction);
            this.$rpc.resolve(results);
        } else {
            // Single transaction result (backward compatible)
            const result: SignedTransaction = convertToSignedTransaction(this.keyguardResult);
            this.$rpc.resolve(result);
        }
    }
}
</script>
