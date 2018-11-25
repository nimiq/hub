<template></template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { ParsedSignTransactionRequest } from '../lib/RequestTypes';
import { SignTransactionRequest as KSignTransactionRequest } from '@nimiq/keyguard-client';
import RpcApi from '../lib/RpcApi';
import { WalletStore } from '@/lib/WalletStore';
import staticStore, { Static } from '../lib/StaticStore';

@Component
export default class SignTransaction extends Vue {
    @Static private request!: ParsedSignTransactionRequest;

    public async created() {
        // Since the sign-transaction flow does not currently have a landing page in the AccountsManager,
        // there is also no place to display an error or have the user try again. Thus we forward the error
        // directly to the caller (the Safe, for example) which automatically closes the window from the
        // caller side.

        // Forward user through AccountsManager to Keyguard

        const wallet = await WalletStore.Instance.get(this.request.walletId);
        if (!wallet) throw new Error('Wallet ID not found');
        const account = wallet.accounts.get(this.request.sender.toUserFriendlyAddress());
        if (!account) throw new Error('Sender address not found!'); // TODO Search contracts when address not found

        const request: KSignTransactionRequest = {
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
            networkId: this.request.networkId,
        };

        const storedRequest = Object.assign({}, request, {
            sender: Array.from(request.sender),
            recipient: Array.from(request.recipient),
            data: Array.from(request.data || []),
        });
        staticStore.keyguardRequest = storedRequest;

        const client = RpcApi.createKeyguardClient(this.$store, staticStore);
        client.signTransaction(request).catch(console.error); // TODO: proper error handling
    }
}
</script>
