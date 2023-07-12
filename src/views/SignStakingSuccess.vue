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
        const tx = await (this.$refs.network as Network).createTx(Object.assign(
            { signerPubKey: this.keyguardResult.publicKey },
            this.keyguardRequest,
            this.keyguardResult,
            StakingSignallingTypes.includes(this.keyguardRequest.type) ? { value: 0, flags: 0b10 } : {},
            this.keyguardRequest.type === StakingTransactionType.UNSTAKE
                ? { proofPrefix: new Uint8Array([StakingTransactionType.UNSTAKE])}
                : {},
        ));
        const result: SignedTransaction = await (this.$refs.network as Network).makeSignTransactionResult(tx);

        // Overwrite serializedTx with Albatross serialization format
        result.serializedTx = Nimiq.BufferUtils.toHex(this.keyguardResult.serializedTx);

        this.$rpc.resolve(result);
    }
}
</script>
