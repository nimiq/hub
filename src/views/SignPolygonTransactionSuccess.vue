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
            message: this.keyguardResult.message,
            signature: this.keyguardResult.signature,
        };

        this.$rpc.resolve(result);
    }
}
</script>
