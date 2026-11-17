<template></template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { ParsedCreateMultisigCommitmentsRequest } from '../lib/RequestTypes';
import KeyguardClient from '@nimiq/keyguard-client';
import { Static } from '../lib/StaticStore';
import { WalletInfo } from '../lib/WalletInfo';
import { Getter } from 'vuex-class';
import { keyguardMultisigTransactionInfo } from '../lib/MultisigRequestParsing';

/**
 * Round 1 of signing a multisig transaction, see SignMultisigTransaction.vue for round 2.
 */
@Component
export default class CreateMultisigCommitments extends Vue {
    @Static private request!: ParsedCreateMultisigCommitmentsRequest;
    @Getter private findWalletByAddress!: (address: string, includeContracts: boolean) => WalletInfo | undefined;

    public async created() {
        // Forward user through Hub to Keyguard

        // existence checked in RpcApi
        const signerAccount = this.findWalletByAddress(this.request.signer.toUserFriendlyAddress(), true)!;
        const signer = signerAccount.findSignerForAddress(this.request.signer)!;

        const request: KeyguardClient.CreateMultisigCommitmentsRequest = {
            appName: this.request.appName,

            keyId: signerAccount.keyId,
            keyPath: signer.path,
            keyLabel: signerAccount.labelForKeyguard || [...signerAccount.accounts.values()][0].label,

            // Must be identical to round 2
            ...keyguardMultisigTransactionInfo(this.request),
            senderLabel: this.request.senderLabel,

            multisigConfig: this.request.multisigConfig,
        };

        const client = this.$rpc.createKeyguardClient(true);
        client.createMultisigCommitments(request);
    }
}
</script>
