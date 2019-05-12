<template></template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { ParsedExportRequest } from '../lib/RequestTypes';
import KeyguardClient from '@nimiq/keyguard-client';
import { WalletStore } from '@/lib/WalletStore';
import { Static } from '../lib/StaticStore';

@Component
export default class Export extends Vue {
    @Static private request!: ParsedExportRequest;

    public async created() {
        const wallet = (await WalletStore.Instance.get(this.request.walletId))!;

        const request: KeyguardClient.ExportRequest = {
            appName: this.request.appName,
            keyId: wallet.keyId,
            keyLabel: wallet.label,
            fileOnly: this.request.fileOnly,
            wordsOnly: this.request.wordsOnly,
        };

        const client = this.$rpc.createKeyguardClient(true);
        client.export(request);
    }
}
</script>
