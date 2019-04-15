<template></template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { ParsedSimpleRequest } from '../lib/RequestTypes';
import { SimpleRequest } from '@nimiq/keyguard-client';
import { WalletStore } from '@/lib/WalletStore';
import { Static } from '../lib/StaticStore';

@Component
export default class Export extends Vue {
    @Static private request!: ParsedSimpleRequest;

    public async created() {
        const wallet = (await WalletStore.Instance.get(this.request.walletId))!;

        const request: SimpleRequest = {
            appName: this.request.appName,
            keyId: wallet.keyId,
            keyLabel: wallet.label,
        };

        const client = this.$rpc.createKeyguardClient();
        client.export(request);
    }
}
</script>
