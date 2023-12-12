<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { SignedTransaction } from '../../client/PublicRequestTypes';
import { State } from 'vuex-class';
import KeyguardClient from '@nimiq/keyguard-client';
import { bytesToHex, hexToBytes } from '../lib/BufferUtils';

@Component({})
export default class SignTransactionSuccess extends Vue {
    @State private keyguardResult!: KeyguardClient.SignTransactionResult;

    private async mounted() {
        const { Transaction } = await window.loadAlbatross();

        const hex = bytesToHex(this.keyguardResult.serializedTx);
        const tx = Transaction.fromAny(hex);
        const plain = tx.toPlain();

        const result: SignedTransaction = {
            transaction: this.keyguardResult.serializedTx,
            serializedTx: hex,
            hash: plain.transactionHash,
            raw: {
                ...plain,
                senderType: tx.senderType,
                recipientType: tx.recipientType,
                proof: tx.proof,
                signerPublicKey: 'publicKey' in plain.proof
                    ? hexToBytes(plain.proof.publicKey)
                    : 'creatorPublicKey' in plain.proof
                        ? hexToBytes(plain.proof.creatorPublicKey)
                        : new Uint8Array(0),
                signature: 'signature' in plain.proof
                    ? hexToBytes(plain.proof.signature)
                    : 'creatorSignature' in plain.proof
                        ? hexToBytes(plain.proof.creatorSignature)
                        : new Uint8Array(0),
                extraData: tx.data,
                networkId: tx.networkId,
            },
        };

        this.$rpc.resolve(result);
    }
}
</script>
