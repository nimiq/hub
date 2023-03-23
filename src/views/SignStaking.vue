<template></template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { ParsedSignStakingRequest } from '../lib/RequestTypes';
import KeyguardClient from '@nimiq/keyguard-client';
import staticStore, { Static } from '../lib/StaticStore';
import { WalletInfo } from '../lib/WalletInfo';
import { Getter } from 'vuex-class';
import { StakingTransactionType } from '../lib/Constants';

@Component
export default class SignStaking extends Vue {
    @Static private request!: ParsedSignStakingRequest;
    @Getter private findWalletByAddress!: (address: string, includeContracts: boolean) => WalletInfo | undefined;

    public async created() {
        // Forward user through Hub to Keyguard

        let senderAddress: Nimiq.Address;
        let senderLabel: string | undefined;
        let senderType: Nimiq.Account.Type | 3 /* Staking */;
        let keyId: string;
        let keyPath: string;
        let keyLabel: string | undefined;
        let recipientAddress: Nimiq.Address;
        let recipientLabel: string | undefined;
        let recipientType: Nimiq.Account.Type | 3 /* Staking */;

        const isUnstaking = this.request.type === StakingTransactionType.UNSTAKE;

        if (isUnstaking) {
            // existence checked in RpcApi
            const wallet = this.findWalletByAddress(this.request.recipient.toUserFriendlyAddress(), false)!;
            const signer = wallet.findSignerForAddress(this.request.recipient)!;

            senderAddress = this.request.sender as Nimiq.Address;
            senderLabel = this.$t('Staking Contract') as string;
            senderType = 3; // Staking
            keyId = wallet.keyId;
            keyPath = signer.path;
            keyLabel = wallet.labelForKeyguard;
            recipientAddress = signer.address;
            recipientLabel = signer.label;
            recipientType = Nimiq.Account.Type.BASIC;
        } else {
            if (this.request.sender instanceof Nimiq.Address) {
                // existence checked in RpcApi
                const wallet = this.findWalletByAddress(this.request.sender.toUserFriendlyAddress(), false)!;
                const signer = wallet.findSignerForAddress(this.request.sender)!;

                senderAddress = this.request.sender;
                senderLabel = signer.label;
                senderType = Nimiq.Account.Type.BASIC;
                keyId = wallet.keyId;
                keyPath = signer.path;
                keyLabel = wallet.labelForKeyguard;
            } else {
                ({
                    address: senderAddress,
                    label: senderLabel,
                    type: senderType,
                    signerKeyId: keyId,
                    signerKeyPath: keyPath,
                    walletLabel: keyLabel,
                } = {
                    type: Nimiq.Account.Type.BASIC,
                    ...this.request.sender,
                });
            }
            recipientAddress = this.request.recipient;
            recipientLabel = this.request.recipientLabel;
            recipientType = this.request.recipientType;
        }

        const request: KeyguardClient.SignStakingRequest = {
            appName: this.request.appName,

            keyId,
            keyPath,
            keyLabel,

            sender: senderAddress.serialize(),
            senderLabel,
            senderType,
            recipient: recipientAddress.serialize(),
            recipientType,
            recipientLabel,
            value: this.request.value,
            fee: this.request.fee,
            validityStartHeight: this.request.validityStartHeight,
            data: this.request.data,
            flags: this.request.flags,

            type: this.request.type,
            delegation: this.request.delegation,
        };

        staticStore.keyguardRequest = request;

        const client = this.$rpc.createKeyguardClient(true);
        client.signStaking(request);
    }
}
</script>
