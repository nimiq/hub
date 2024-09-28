<template></template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { ParsedSignMultisigTransactionRequest } from '../lib/RequestTypes';
import KeyguardClient from '@nimiq/keyguard-client';
import staticStore, { Static } from '../lib/StaticStore';
import { WalletInfo } from '../lib/WalletInfo';
import { Getter } from 'vuex-class';

@Component
export default class SignMultisigTransaction extends Vue {
    @Static private request!: ParsedSignMultisigTransactionRequest;
    @Getter private findWalletByAddress!: (address: string, includeContracts: boolean) => WalletInfo | undefined;

    public async created() {
        // Forward user through Hub to Keyguard

        let keyId: string;
        let keyPath: string;
        let keyLabel: string;

        if (this.request.signer instanceof Nimiq.Address) {
            // existence checked in RpcApi
            const signerAccount = this.findWalletByAddress(this.request.signer.toUserFriendlyAddress(), true)!;
            const signer = signerAccount.findSignerForAddress(this.request.signer)!;

            keyId = signerAccount.keyId;
            keyPath = signer.path;
            keyLabel = signerAccount.labelForKeyguard || [...signerAccount.accounts.values()][0].label;
        } else {
            ({
                signerKeyId: keyId,
                signerKeyPath: keyPath,
                walletLabel: keyLabel,
            } = this.request.signer);
        }

        const request: KeyguardClient.SignMultisigTransactionRequest = {
            layout: 'standard',
            appName: this.request.appName,

            keyId,
            keyPath,
            keyLabel,

            sender: this.request.sender.serialize(),
            senderLabel: this.request.senderLabel,
            senderType: this.request.senderType,
            recipient: this.request.recipient.serialize(),
            recipientType: this.request.recipientType,
            recipientLabel: this.request.recipientLabel,
            value: this.request.value,
            fee: this.request.fee || 0,
            validityStartHeight: this.request.validityStartHeight,
            data: this.request.data,
            flags: this.request.flags,

            multisigConfig: this.request.multisigConfig,
        };

        // staticStore.keyguardRequest = request;

        const client = this.$rpc.createKeyguardClient(true);
        client.signMultisigTransaction(request);
    }
}
</script>
