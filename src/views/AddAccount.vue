<template></template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { ParsedAddAccountRequest } from '../lib/RequestTypes';
import { DeriveAddressRequest } from '@nimiq/keyguard-client';
import { Static } from '../lib/StaticStore';
import { WalletStore } from '@/lib/WalletStore';
import { WalletType } from '@/lib/WalletInfo';
import { State } from 'vuex-class';

@Component
export default class AddAccount extends Vue {
    @Static private request!: ParsedAddAccountRequest;
    @State private keyguardResult?: KeyguardRequest.DeriveAddressResult;

    public async created() {
        if (this.keyguardResult) return;

        const wallet = await WalletStore.Instance.get(this.request.walletId);
        if (!wallet) {
            this.$rpc.reject(new Error('Wallet not found'));
            return;
        }
        if (wallet.type === WalletType.LEGACY) {
            this.$rpc.reject(new Error('Cannot add account to single-account wallet'));
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
            keyId: this.request.walletId,
            baseKeyPath: `m/44'/242'/0'`,
            indicesToDerive: new Array(14).fill(null).map((_: any, i: number) => `${firstIndexToDerive + i}'`),
        };

        const client = this.$rpc.createKeyguardClient();
        client.deriveAddress(request).catch(console.error); // TODO: proper error handling
    }
}
</script>
