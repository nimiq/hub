<template></template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { ParsedChangePasswordRequest } from '../lib/RequestTypes';
import { WalletStore } from '@/lib/WalletStore';
import { Static } from '../lib/StaticStore';
import KeyguardClient from '@nimiq/keyguard-client';

@Component
export default class ChangePassword extends Vue {
    @Static private request!: ParsedChangePasswordRequest;

    public async created() {
        const wallet = await WalletStore.Instance.get(this.request.walletId);
        if (!wallet) throw new Error('Account ID not found');

        const request: KeyguardClient.SimpleRequest = {
            appName: this.request.appName,
            keyId: this.request.walletId,
            keyLabel: wallet.label,
        };

        const client = this.$rpc.createKeyguardClient();
        client.changePassword(request);
    }
}
</script>
