<template></template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { ParsedExportFileRequest } from '../lib/RequestTypes';
import { SimpleRequest } from '@nimiq/keyguard-client';
import { WalletStore } from '@/lib/WalletStore';
import { Static } from '../lib/StaticStore';

@Component
export default class ExportFile extends Vue {
    @Static private request!: ParsedExportFileRequest;

    public async created() {
        const wallet = await WalletStore.Instance.get(this.request.walletId);
        if (!wallet) throw new Error('Wallet ID not found');

        const request: SimpleRequest = {
            appName: this.request.appName,
            keyId: this.request.walletId,
            keyLabel: wallet.label,
        };

        const client = this.$rpc.createKeyguardClient();
        client.exportFile(request).catch(console.error); // TODO: proper error handling
    }
}
</script>
