<template></template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { ParsedChangePassphraseRequest } from '../lib/RequestTypes';
import RpcApi from '../lib/RpcApi';
import { SimpleRequest } from '@nimiq/keyguard-client';
import { WalletStore } from '@/lib/WalletStore';
import staticStore, { Static } from '../lib/StaticStore';

@Component
export default class ChangePassphrase extends Vue {
    @Static private request!: ParsedChangePassphraseRequest;

    public async created() {
        const wallet = await WalletStore.Instance.get(this.request.walletId);
        if (!wallet) throw new Error('Wallet ID not found');

        const request: SimpleRequest = {
            appName: this.request.appName,
            keyId: this.request.walletId,
            keyLabel: wallet.label,
        };

        const client = RpcApi.createKeyguardClient(this.$store, staticStore);
        client.changePassphrase(request).catch(console.error); // TODO: proper error handling
    }
}
</script>
