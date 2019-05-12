<template></template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { ParsedSimpleRequest } from '../lib/RequestTypes';
import { WalletStore } from '@/lib/WalletStore';
import { Static } from '../lib/StaticStore';
import KeyguardClient from '@nimiq/keyguard-client';

@Component
export default class Logout extends Vue {
    @Static private request!: ParsedSimpleRequest;

    public async created() {
        const wallet = (await WalletStore.Instance.get(this.request.walletId))!;

        const request: KeyguardClient.RemoveKeyRequest = {
            appName: this.request.appName,
            keyId: wallet.keyId,
            keyLabel: wallet.label,
        };

        const client = this.$rpc.createKeyguardClient(true);
        client.remove(request);
    }
}
</script>
