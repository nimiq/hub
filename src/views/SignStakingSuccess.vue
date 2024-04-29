<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { SignedTransaction } from '../../client/PublicRequestTypes';
import { State } from 'vuex-class';
import KeyguardClient from '@nimiq/keyguard-client';
import { bytesToHex, hexToBytes } from '../lib/BufferUtils';

@Component({})
export default class SignStakingSuccess extends Vue {
    @State private keyguardResult!: KeyguardClient.SignStakingResult[];

    private async mounted() {
        const { Transaction } = await window.loadAlbatross();

        const result: SignedTransaction[] = this.keyguardResult.map((signedTransaction) => {
            const hex = bytesToHex(signedTransaction.transaction);
            const tx = Transaction.fromAny(hex);
            const plain = tx.toPlain();

            return {
                transaction: signedTransaction.transaction,
                serializedTx: hex,
                hash: plain.transactionHash,
                raw: {
                    ...plain,
                    senderType: tx.senderType,
                    recipientType: tx.recipientType,
                    proof: tx.proof,
                    signerPublicKey: 'publicKey' in plain.proof
                        ? hexToBytes(plain.proof.publicKey)
                        : new Uint8Array(0),
                    signature: 'signature' in plain.proof
                        ? hexToBytes(plain.proof.signature)
                        : new Uint8Array(0),
                    extraData: tx.data,
                    networkId: tx.networkId,
                },
            } as SignedTransaction;
        });

        this.$rpc.resolve(result);
    }
}
</script>
