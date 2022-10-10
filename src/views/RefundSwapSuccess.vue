<template>
    <Network ref="network" :visible="false"/>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { State } from 'vuex-class';
import KeyguardClient from '@nimiq/keyguard-client';
import { SwapAsset } from '@nimiq/fastspot-api';
import Network from '../components/Network.vue';
import { ParsedRefundSwapRequest } from '../lib/RequestTypes';
import { SignedBtcTransaction, SignedTransaction } from '../lib/PublicRequestTypes';
import { Static } from '../lib/StaticStore';
import patchMerkleTree from '../lib/MerkleTreePatch';

@Component({components: {Network}})
export default class SignBtcTransactionSuccess extends Vue {
    @Static private request!: ParsedRefundSwapRequest;
    @State private keyguardResult!: KeyguardClient.SignedBitcoinTransaction | KeyguardClient.SignatureResult;

    private async mounted() {
        if ('signature' in this.keyguardResult && this.request.refund.type === SwapAsset.NIM) {
            const tx = await (this.$refs.network as Network).createTx(Object.assign({
                signerPubKey: this.keyguardResult.publicKey,
            }, this.keyguardResult, this.request.refund, {
                senderType: Nimiq.Account.Type.HTLC,
            }));

            const proof = new Nimiq.SerialBuffer(1 + tx.proof.length);
            proof.writeUint8(Nimiq.HashedTimeLockedContract.ProofType.TIMEOUT_RESOLVE);
            proof.write(new Nimiq.SerialBuffer(tx.proof)); // Current tx.proof is a regular SignatureProof
            tx.proof = proof;

            // Validate that the transaction is valid
            patchMerkleTree();
            if (!tx.verify()) {
                this.$rpc.reject(new Error('NIM transaction is invalid'));
                return;
            }

            const result: SignedTransaction = await (this.$refs.network as Network).makeSignTransactionResult(tx);

            this.$rpc.resolve(result);
        }

        if ('transactionHash' in this.keyguardResult) {
            const result: SignedBtcTransaction = {
                serializedTx: this.keyguardResult.raw,
                hash: this.keyguardResult.transactionHash,
            };

            this.$rpc.resolve(result);
        }
    }
}
</script>
