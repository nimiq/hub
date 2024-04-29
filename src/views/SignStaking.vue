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

        const { Transaction } = await window.loadAlbatross();
        const transaction = Transaction.fromAny(Nimiq.BufferUtils.toHex(
            this.request.transactions[this.request.transactions.length - 1],
        )).toPlain();

        console.log(transaction);

        // @ts-ignore Wrong type definition
        if (transaction.senderType === 3) {
            const signerAddress = transaction.recipient;
            const wallet = this.findWalletByAddress(signerAddress, false);
            const signer = wallet?.findSignerForAddress(Nimiq.Address.fromUserFriendlyAddress(signerAddress));
            if (!wallet || !signer) throw new Error('Signer not found');

            // @ts-ignore Wrong type definition
            if (transaction.recipientType !== 0) {
                    throw new Error('Recipient must be a basic account when sender is staking contract');
            }

            keyId = wallet.keyId;
            keyPath = signer.path;
            keyLabel = wallet.labelForKeyguard;
            senderLabel = this.request.senderLabel || this.$t('Staking Contract') as string;
            recipientLabel = signer.label;
        // @ts-ignore Wrong type
        } else if (transaction.recipientType === 3) {
            const signerAddress = transaction.sender;
            const wallet = this.findWalletByAddress(signerAddress, false);
            const signer = wallet?.findSignerForAddress(Nimiq.Address.fromUserFriendlyAddress(signerAddress));
            if (!wallet || !signer) throw new Error('Signer not found');

            // @ts-ignore Wrong type definition
            if (transaction.senderType !== 0) {
                throw new Error('Sender must be a basic account when recipient is staking contract');
            }

            keyId = wallet.keyId;
            keyPath = signer.path;
            keyLabel = wallet.labelForKeyguard;
            senderLabel = signer.label;
            recipientLabel = this.request.recipientLabel || this.$t('Staking Contract') as string;
        } else {
            throw new Error('Sender or recipient must be the staking contract');
        }

        const request: KeyguardClient.SignStakingRequest = {
            appName: this.request.appName,

            keyId,
            keyPath,
            keyLabel,

            senderLabel,
            recipientLabel,

            transaction: this.request.transactions,
        };

        const client = this.$rpc.createKeyguardClient(true);
        client.signStaking(request);
    }
}
</script>
