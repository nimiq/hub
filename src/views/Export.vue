<template></template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { ParsedExportRequest } from '../lib/RequestTypes';
import { SimpleRequest } from '@nimiq/keyguard-client';
import { State } from 'vuex-class';
import { WalletStore } from '@/lib/WalletStore';
import { Static } from '../lib/StaticStore';
import KeyguardClient from '@nimiq/keyguard-client';

@Component
export default class Export extends Vue {
    @Static private request!: ParsedExportRequest;
    @State private keyguardResult!: KeyguardClient.SimpleResult;

    public async created() {
        if (this.keyguardResult) return;
        const wallet = await WalletStore.Instance.get(this.request.walletId);
        if (!wallet) throw new Error('Account ID not found');

        const request: SimpleRequest = {
            appName: this.request.appName,
            keyId: this.request.walletId,
            keyLabel: wallet.label,
        };

        const client = this.$rpc.createKeyguardClient();
        client.export(request);
    }
}
</script>
