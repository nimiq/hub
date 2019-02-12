<template></template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { ParsedChangePassphraseRequest } from '../lib/RequestTypes';
import { SimpleRequest } from '@nimiq/keyguard-client';
import { WalletStore } from '@/lib/WalletStore';
import { Static } from '../lib/StaticStore';
import { State } from 'vuex-class';

@Component
export default class ChangePassphrase extends Vue {
    @Static private request!: ParsedChangePassphraseRequest;
    @State private keyguardResult?: KeyguardRequest.SimpleResult;

    public async created() {
        if (this.keyguardResult) return;

        const wallet = await WalletStore.Instance.get(this.request.walletId);
        if (!wallet) throw new Error('Wallet ID not found');

        const request: SimpleRequest = {
            appName: this.request.appName,
            keyId: this.request.walletId,
            keyLabel: wallet.label,
        };

        const client = this.$rpc.createKeyguardClient();
        client.changePassphrase(request).catch(console.error); // TODO: proper error handling
    }
}
</script>
