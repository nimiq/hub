<template></template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { ParsedSignStakingRequest } from '../lib/RequestTypes';
import KeyguardClient from '@nimiq/keyguard-client';
import { Static } from '../lib/StaticStore';
import { WalletInfo } from '../lib/WalletInfo';
import { Getter } from 'vuex-class';

@Component
export default class SignStaking extends Vue {
    @Static private request!: ParsedSignStakingRequest;
    @Getter private findWalletByAddress!: (address: string, includeContracts: boolean) => WalletInfo | undefined;

    public async created() {
        // Determine signer by last transaction and forward user to Keyguard

        let senderLabel = this.request.senderLabel;
        let keyId: string;
        let keyPath: string;
        let keyLabel: string | undefined;
        let recipientLabel = this.request.recipientLabel;

        const finalTransaction = this.request.transactions[this.request.transactions.length - 1];
        console.log(finalTransaction);

        const signerSide = finalTransaction.senderType === 'basic' ? 'sender' as const : 'recipient' as const;
        const signerAddress = finalTransaction[signerSide];
        // We know that these exist as their existence was already checked in RpcApi.ts. Don't have to handle contracts
        // as such are disallowed by RequestParser.
        const account = this.findWalletByAddress(signerAddress, false)!;
        const signer = account.findSignerForAddress(Nimiq.Address.fromUserFriendlyAddress(signerAddress))!;

        keyId = account.keyId;
        keyPath = signer.path;
        keyLabel = account.labelForKeyguard;
        if (signerSide === 'recipient') {
            senderLabel = this.request.senderLabel || this.$t('Staking Contract') as string;
            recipientLabel = signer.label;
        } else {
            senderLabel = signer.label;
            recipientLabel = this.request.recipientLabel || this.$t('Staking Contract') as string;
        }

        const request: KeyguardClient.SignStakingRequest = {
            appName: this.request.appName,

            keyId,
            keyPath,
            keyLabel,

            senderLabel,
            recipientLabel,

            transaction: this.request.transactions
                .map((plainTransaction) => Nimiq.Transaction.fromPlain(plainTransaction).serialize()),
        };

        const client = this.$rpc.createKeyguardClient(true);
        client.signStaking(request);
    }
}
</script>
