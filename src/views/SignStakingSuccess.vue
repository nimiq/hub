<template>
    <Network ref="network" :visible="false"/>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import Network from '@/components/Network.vue';
import { SignedTransaction } from '../../client/PublicRequestTypes';
import { State } from 'vuex-class';
import { Static } from '../lib/StaticStore';
import KeyguardClient from '@nimiq/keyguard-client';
import { StakingSignallingTypes, StakingTransactionType } from '../lib/Constants';

@Component({components: {Network}})
export default class SignStakingSuccess extends Vue {
    @Static private keyguardRequest!: KeyguardClient.SignStakingRequest;
    @State private keyguardResult!: KeyguardClient.SignStakingResult;

    private async mounted() {
        const result: SignedTransaction[] = await Promise.all(this.keyguardResult.map(async (keyguardResult) => {
            const tx = await (this.$refs.network as Network).createTx(Object.assign(
                { signerPubKey: keyguardResult.publicKey },
                this.keyguardRequest,
                keyguardResult,
                StakingSignallingTypes.includes(this.keyguardRequest.type) ? { value: 0, flags: 0b10 } : {},
                this.keyguardRequest.type === StakingTransactionType.UNSTAKE
                    ? { proofPrefix: new Uint8Array([StakingTransactionType.UNSTAKE])}
                    : {},
            ));
            const res: SignedTransaction = await (this.$refs.network as Network).makeSignTransactionResult(tx);
            // Overwrite serializedTx with Albatross serialization format
            res.serializedTx = Nimiq.BufferUtils.toHex(keyguardResult.serializedTx);
            return res;
        }));

        this.$rpc.resolve(result);
    }
}
</script>
