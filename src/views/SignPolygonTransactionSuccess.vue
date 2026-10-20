<template></template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { SignedPolygonTransaction, SignedPolygonGaslessTransfer } from '../../client/PublicRequestTypes';
import { State } from 'vuex-class';
import KeyguardClient from '@nimiq/keyguard-client';

@Component
export default class SignPolygonTransactionSuccess extends Vue {
    @State private keyguardResult!:
        KeyguardClient.SignedPolygonTransaction
        | KeyguardClient.SignedPolygonGaslessTransfer;

    private async mounted() {
        const result: SignedPolygonTransaction | SignedPolygonGaslessTransfer = 'message' in this.keyguardResult ? {
            message: this.keyguardResult.message,
            signature: this.keyguardResult.signature,
        } : {
            request: this.keyguardResult.request,
            signature: this.keyguardResult.signature,
            authorization: this.keyguardResult.authorization,
        };

        this.$rpc.resolve(result);
    }
}
</script>
