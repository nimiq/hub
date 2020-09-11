<template></template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { SignedBtcTransaction } from '../lib/PublicRequestTypes';
import { State } from 'vuex-class';
import KeyguardClient from '@nimiq/keyguard-client';

@Component
export default class SignBtcTransactionSuccess extends Vue {
    @State private keyguardResult!: KeyguardClient.SignedBitcoinTransaction;

    private async mounted() {
        const result: SignedBtcTransaction = {
            serializedTx: this.keyguardResult.raw,
            hash: this.keyguardResult.transactionHash,
        };

        this.$rpc.resolve(result);
    }
}
</script>
