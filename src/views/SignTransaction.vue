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
    @Getter private findWalletByAddress!: (address: string) => WalletInfo | undefined;

    public async created() {
        // Forward user through AccountsManager to Keyguard

        const wallet = this.findWalletByAddress(this.request.sender.toUserFriendlyAddress());
        if (!wallet) {
            this.$rpc.reject(new Error('Address not found'));
            return;
        }

        let account = wallet.accounts.get(this.request.sender.toUserFriendlyAddress());
        let contract: ContractInfo | undefined;
        if (!account) {
            // Search contracts
            contract = wallet.findContractByAddress(this.request.sender);
            if (contract) {
                if (contract.type === Nimiq.Account.Type.HTLC) {
                    this.$rpc.reject(new Error('HTLC contracts are not yet supported for transaction signing'));
                    return;
                }
                account = wallet.accounts.get((contract as VestingContractInfo).owner.toUserFriendlyAddress());
            }
        }

        const request: KeyguardClient.SignTransactionRequest = {
            layout: 'standard',
            appName: this.request.appName,

            keyId: wallet.id,
            keyPath: account!.path,
            keyLabel: wallet.label,

            sender: (contract || account!).address.serialize(),
            senderType: contract ? contract.type : Nimiq.Account.Type.BASIC,
            senderLabel: (contract || account!).label,
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

        const client = this.$rpc.createKeyguardClient();
        client.signTransaction(request);
    }
}
</script>
