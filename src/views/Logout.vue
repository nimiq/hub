<template></template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { ParsedLogoutRequest } from '../lib/RequestTypes';
import { WalletStore } from '@/lib/WalletStore';
import { Static } from '../lib/StaticStore';
import { State } from 'vuex-class';
import KeyguardClient from '@nimiq/keyguard-client';

@Component
export default class Logout extends Vue {
    @Static private request!: ParsedLogoutRequest;
    @State private keyguardResult?: KeyguardClient.SimpleResult;

    public async created() {
        if (this.keyguardResult) return;

        const wallet = await WalletStore.Instance.get(this.request.walletId);
        if (!wallet) throw new Error('Wallet ID not found');

        const request: KeyguardClient.RemoveKeyRequest = {
            appName: this.request.appName,
            keyId: this.request.walletId,
            keyLabel: wallet.label,
        };

        const client = this.$rpc.createKeyguardClient();
        client.remove(request).catch(console.error); // TODO: proper error handling
    }
}
</script>
