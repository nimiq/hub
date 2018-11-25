<template></template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { ParsedLogoutRequest } from '../lib/RequestTypes';
import { SimpleRequest } from '@nimiq/keyguard-client';
import { WalletStore } from '@/lib/WalletStore';
import { Static } from '../lib/StaticStore';

@Component
export default class Logout extends Vue {
    @Static private request!: ParsedLogoutRequest;

    public async created() {
        const wallet = await WalletStore.Instance.get(this.request.walletId);
        if (!wallet) throw new Error('Wallet ID not found');

        const request: SimpleRequest = {
            appName: this.request.appName,
            keyId: this.request.walletId,
            keyLabel: wallet.label,
        };

        const client = this.$rpc.createKeyguardClient();
        client.remove(request).catch(console.error); // TODO: proper error handling
    }
}
</script>
