<template></template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { ParsedSimpleRequest } from '../lib/RequestTypes';
import { DeriveAddressRequest } from '@nimiq/keyguard-client';
import { Static } from '../lib/StaticStore';
import { WalletStore } from '@/lib/WalletStore';
import { WalletType } from '@/lib/WalletInfo';

@Component
export default class AddAccount extends Vue {
    @Static private request!: ParsedSimpleRequest;

    public async created() {
        const wallet = (await WalletStore.Instance.get(this.request.walletId))!;
        if (wallet.type === WalletType.LEGACY) {
            this.$rpc.reject(new Error('Cannot add address to single-address account'));
            return;
        }

        let firstIndexToDerive = 0;

        const latestAccount = Array.from(wallet.accounts.values()).pop();
        if (latestAccount) {
            const pathArray = latestAccount.path.split('/');
            firstIndexToDerive = parseInt(pathArray[pathArray.length - 1], 10) + 1;
        }

        const request: DeriveAddressRequest = {
            appName: this.request.appName,
            keyId: wallet.keyId,
            baseKeyPath: `m/44'/242'/0'`,
            indicesToDerive: new Array(14).fill(null).map((_: any, i: number) => `${firstIndexToDerive + i}'`),
        };

        const client = this.$rpc.createKeyguardClient();
        client.deriveAddress(request);
    }
}
</script>
