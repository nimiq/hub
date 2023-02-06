<template></template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { SignedPolygonTransaction } from '../../client/PublicRequestTypes';
import { State } from 'vuex-class';
import KeyguardClient from '@nimiq/keyguard-client';

@Component
export default class SignPolygonTransactionSuccess extends Vue {
    @State private keyguardResult!: KeyguardClient.SignedPolygonTransaction;

    private async mounted() {
        const result: SignedPolygonTransaction = {
            serializedTx: this.keyguardResult.raw,
            hash: this.keyguardResult.transactionHash,
        };

        this.$rpc.resolve(result);
    }
}
</script>
