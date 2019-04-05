<template></template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { ParsedSignTransactionRequest } from '../lib/RequestTypes';
import KeyguardClient from '@nimiq/keyguard-client';
import { WalletStore } from '@/lib/WalletStore';
import staticStore, { Static } from '../lib/StaticStore';
import { WalletInfo } from '../lib/WalletInfo';
import { Getter } from 'vuex-class';

@Component
export default class SignTransaction extends Vue {
    @Static private request!: ParsedSignTransactionRequest;
    @Getter private findWalletByAddress!: (address: string) => WalletInfo | undefined;

    public async created() {
        // Forward user through AccountsManager to Keyguard
        let wallet: WalletInfo;
        if (this.request.walletId) {
            const foundWallet = await WalletStore.Instance.get(this.request.walletId);
            if (!foundWallet) {
                this.$rpc.reject(new Error('Account ID not found'));
                return;
            }
            wallet = foundWallet;
        } else {
            const foundWallet = this.findWalletByAddress(this.request.sender.toUserFriendlyAddress());
            if (!foundWallet) {
                this.$rpc.reject(new Error('Address not found'));
                return;
            }
            wallet = foundWallet;
        }
        const account = wallet.accounts.get(this.request.sender.toUserFriendlyAddress());
        if (!account) {
            // TODO Search contracts when address not found
            this.$rpc.reject(new Error('Address not found'));
            return;
        }

        const request: KeyguardClient.SignTransactionRequest = {
            layout: 'standard',
            appName: this.request.appName,

            keyId: wallet.id,
            keyPath: account.path,
            keyLabel: wallet.label,

            sender: this.request.sender.serialize(),
            senderType: Nimiq.Account.Type.BASIC, // FIXME Detect appropriate type here
            senderLabel: account.label,
            recipient: this.request.recipient.serialize(),
            recipientType: this.request.recipientType,
            recipientLabel: undefined, // XXX Should we accept a recipient label from outside?
            value: this.request.value,
            fee: this.request.fee || 0,
            validityStartHeight: this.request.validityStartHeight,
            data: this.request.data,
            flags: this.request.flags,
        };

        staticStore.keyguardRequest = request;

        const client = this.$rpc.createKeyguardClient();
        client.signTransaction(request);
    }
}
</script>
