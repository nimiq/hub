<template></template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { ParsedSignTransactionRequest } from '../lib/RequestTypes';
import KeyguardClient from '@nimiq/keyguard-client';
import { WalletStore } from '@/lib/WalletStore';
import staticStore, { Static } from '../lib/StaticStore';
import { VestingContractInfo, ContractInfo } from '@/lib/ContractInfo';
import { WalletInfo } from '../lib/WalletInfo';
import { Getter } from 'vuex-class';

@Component
export default class SignTransaction extends Vue {
    @Static private request!: ParsedSignTransactionRequest;
    @Getter private findWalletByAddress!: (address: string, includeContracts: boolean) => WalletInfo | undefined;

    public async created() {
        // Forward user through AccountsManager to Keyguard

        const senderAccount = this.findWalletByAddress(this.request.sender.toUserFriendlyAddress(), true)!;
        const senderContract = senderAccount.findContractByAddress(this.request.sender);
        const signer = senderAccount.findSignerForAddress(this.request.sender)!;

        const request: KeyguardClient.SignTransactionRequest = {
            layout: 'standard',
            appName: this.request.appName,

            keyId: senderAccount.keyId,
            keyPath: signer.path,
            keyLabel: senderAccount.label,

            sender: (senderContract || signer).address.serialize(),
            senderType: senderContract ? senderContract.type : Nimiq.Account.Type.BASIC,
            senderLabel: (senderContract || signer).label,
            recipient: this.request.recipient.serialize(),
            recipientType: this.request.recipientType,
            recipientLabel: undefined, // XXX Should we accept a recipient label from outside?
            value: this.request.value,
            fee: this.request.fee,
            validityStartHeight: this.request.validityStartHeight,
            data: this.request.data,
            flags: this.request.flags,
        };

        staticStore.keyguardRequest = request;

        const client = this.$rpc.createKeyguardClient(true);
        client.signTransaction(request);
    }
}
</script>
