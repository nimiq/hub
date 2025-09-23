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
import { SignedBtcTransaction, SignedPolygonTransaction, SignedTransaction } from '../../client/PublicRequestTypes';
import { Static } from '../lib/StaticStore';

@Component({components: {Network}})
export default class SignBtcTransactionSuccess extends Vue {
    @Static private request!: ParsedRefundSwapRequest;
    @State private keyguardResult!:
        KeyguardClient.SignedBitcoinTransaction
        | KeyguardClient.SignatureResult
        | KeyguardClient.SignedPolygonTransaction;

    private async mounted() {
        if ('publicKey' in this.keyguardResult && this.request.refund.type === SwapAsset.NIM) {
            const tx = await (this.$refs.network as Network).createTx(Object.assign({
                signerPubKey: this.keyguardResult.publicKey,
            }, this.keyguardResult, this.request.refund, {
                senderType: Nimiq.AccountType.HTLC,
                recipientData: this.request.refund.extraData,
                proofPrefix: new Uint8Array([2 /* Nimiq.HashedTimeLockedContract.ProofType.TIMEOUT_RESOLVE */]),
            }));

            // Validate that the transaction is valid
            try {
                tx.verify();
            } catch (e) {
                this.$rpc.reject(new Error('NIM transaction is invalid'));
                return;
            }

            const result: SignedTransaction = await (this.$refs.network as Network).makeSignTransactionResult(tx);

            this.$rpc.resolve(result);
            return;
        }

        if ('transactionHash' in this.keyguardResult && this.request.refund.type === SwapAsset.BTC) {
            const result: SignedBtcTransaction = {
                serializedTx: this.keyguardResult.raw,
                hash: this.keyguardResult.transactionHash,
            };

            this.$rpc.resolve(result);
            return;
        }

        if (
            'message' in this.keyguardResult
            && (this.request.refund.type === SwapAsset.USDC_MATIC || this.request.refund.type === SwapAsset.USDC)
        ) {
            const result: SignedPolygonTransaction = {
                message: this.keyguardResult.message,
                signature: this.keyguardResult.signature,
            };

            this.$rpc.resolve(result);
            return;
        }

        throw new Error('Unhandled Keyguard result type');
    }
}
</script>
