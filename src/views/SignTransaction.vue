<template></template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { ParsedSignTransactionRequest, SignTransactionRequestLayout } from '../lib/RequestTypes';
import { patchLegacyRequestSenderType } from '../lib/SignTransactionRequestParsing';
import KeyguardClient from '@nimiq/keyguard-client';
import staticStore, { Static } from '../lib/StaticStore';
import { WalletInfo } from '../lib/WalletInfo';
import { Getter } from 'vuex-class';

type CommonRequestProperties = KeyguardClient.SimpleRequest & { keyPath: string }
    & Pick<KeyguardClient.SignTransactionRequestUnstaking, 'transactions'>;
type CommonStakingRequestProperties = CommonRequestProperties
    & Pick<KeyguardClient.SignTransactionRequestUnstaking, 'senderLabel' | 'validatorImageUrl'>;

@Component
export default class SignTransaction extends Vue {
    @Static private request!: ParsedSignTransactionRequest;
    @Getter private findWalletByAddress!: (address: string, includeContracts: boolean) => WalletInfo | undefined;

    public created() {
        // Forward user through Hub to Keyguard

        let keyguardRequest: KeyguardClient.SignTransactionRequest;

        if (!(this.request.sender instanceof Nimiq.Address)) {
            // The sender object form is only used internally by the Ledger flows, which route to
            // SignTransactionLedger, see ParsedSignTransactionRequest in RequestTypes.ts.
            this.$rpc.reject(new Error('Sign transaction requests with a sender object are not handled here'));
            return;
        }
        // The signer is resolved from the request-level sender, which the request parser verified all transactions
        // against. The sender's label and account type are resolved from the WalletStore, too.
        const requestSender = this.request.sender;
        // existence checked in RpcApi
        const senderAccount = this.findWalletByAddress(requestSender.toUserFriendlyAddress(), true)!;
        const senderContract = senderAccount.findContractByAddress(requestSender);
        const signer = senderAccount.findSignerForAddress(requestSender)!;

        const storeSenderLabel = (senderContract || signer).label;
        const storeSenderType = senderContract ? senderContract.type : Nimiq.AccountType.Basic;
        const keyId = senderAccount.keyId;
        const keyPath = signer.path;
        const keyLabel = senderAccount.labelForKeyguard;

        // The legacy single-transaction request format does not support specifying the senderType, in which case it is
        // determined from the WalletStore.
        patchLegacyRequestSenderType(this.request, storeSenderType);

        let common: CommonRequestProperties | CommonStakingRequestProperties = {
            appName: this.request.appName,
            keyId,
            keyPath,
            keyLabel,
            transactions: this.request.transactions.map((tx) => tx.serialize()),
        };

        if (this.request.layout === SignTransactionRequestLayout.SWITCH_VALIDATOR
            || this.request.layout === SignTransactionRequestLayout.UNSTAKING) {
            common = {
                ...common,
                senderLabel: this.request.senderLabel, // labels the from-validator, not the user
                recipientLabel: this.request.recipientLabel,
                validatorImageUrl: this.request.validatorImageUrl
                    ? this.request.validatorImageUrl.toString()
                    : undefined,
            };

            if (this.request.layout === SignTransactionRequestLayout.SWITCH_VALIDATOR) {
                keyguardRequest = {
                    ...common,
                    layout: 'switch-validator',

                    stakerLabel: this.request.stakerLabel, // labels the user address

                    fromValidatorAddress: this.request.fromValidatorAddress!.toUserFriendlyAddress(),
                    fromValidatorImageUrl: this.request.fromValidatorImageUrl
                        ? this.request.fromValidatorImageUrl.toString()
                        : undefined,
                };
            } else {
                keyguardRequest = {
                    ...common,
                    layout: 'unstaking',

                    validatorAddress: this.request.validatorAddress!.toUserFriendlyAddress(),
                };
            }
        } else if (this.request.transactions.length > 1) {
            // Standard layout with multiple transactions. Same as in the Keyguard's request format, no labels are
            // passed on: the Keyguard displays each transaction's own sender and recipient as plain addresses.
            keyguardRequest = {
                ...common,
                layout: 'standard',
            };
        } else {
            // Standard layout with a single transaction. The Keyguard supports the labels only for this case.
            const [transaction] = common.transactions;

            keyguardRequest = {
                ...common,
                layout: 'standard',

                // The sender is the user's own account; its label comes from the user's account data and can not be
                // set in the request, see SignTransactionRequestStandard.
                senderLabel: storeSenderLabel,
                recipientLabel: this.request.recipientLabel,

                transactions: [transaction], // the single transaction request type requires a tuple with a single entry
            };
        }

        staticStore.keyguardRequest = keyguardRequest;
        const keyguardClient = this.$rpc.createKeyguardClient(true);
        keyguardClient.signTransaction(keyguardRequest);
    }
}
</script>
