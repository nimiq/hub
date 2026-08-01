<template></template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { ParsedSignTransactionRequest } from '../lib/RequestTypes';
import KeyguardClient from '@nimiq/keyguard-client';
import staticStore, { Static } from '../lib/StaticStore';
import { WalletInfo } from '../lib/WalletInfo';
import { Getter } from 'vuex-class';

@Component
export default class SignTransaction extends Vue {
    @Static private request!: ParsedSignTransactionRequest;
    @Getter private findWalletByAddress!: (address: string, includeContracts: boolean) => WalletInfo | undefined;

    public created() {
        // Forward user through Hub to Keyguard

        let senderAddress: Nimiq.Address;
        let senderLabel: string | undefined;
        let senderType: Nimiq.AccountType | undefined;
        let keyId: string;
        let keyPath: string;
        let keyLabel: string | undefined;
        let recipientLabel: string | undefined = this.request.recipientLabel;

        // For staking transactions, determine signer by last transaction (like SignStaking does)
        if (this.request.isStakingRequest && this.request.transactions && this.request.transactions.length > 0) {
            const finalTransaction = this.request.transactions[this.request.transactions.length - 1];
            const signerSide = (finalTransaction as any).senderType === 'basic'
                ? 'sender' as const
                : 'recipient' as const;
            const signerAddress = (finalTransaction as any)[signerSide];

            // Don't have to handle contracts as such are disallowed by RequestParser
            const account = this.findWalletByAddress(signerAddress, false)!;
            const signer = account.findSignerForAddress(Nimiq.Address.fromUserFriendlyAddress(signerAddress))!;

            keyId = account.keyId;
            keyPath = signer.path;
            keyLabel = account.labelForKeyguard;

            if (signerSide === 'recipient') {
                senderLabel = this.request.senderLabel || 'Staking Contract';
                recipientLabel = signer.label;
            } else if (this.request.layout === 'switch-validator' || this.request.layout === 'unstaking') {
                // For custom multi-tx layouts the labels are rendered on cards (validator and/or
                // user-account); do not overwrite with the signer's wallet label.
                senderLabel = this.request.senderLabel;
                recipientLabel = this.request.recipientLabel;
            } else {
                senderLabel = signer.label;
                recipientLabel = this.request.recipientLabel || 'Staking Contract';
            }

            // For staking, senderAddress is always from the first transaction
            senderAddress = this.request.sender instanceof Nimiq.Address
                ? this.request.sender
                : (this.request.sender as any).address;
            senderType = Nimiq.AccountType.Basic; // Will be overridden per transaction
        } else if (this.request.sender instanceof Nimiq.Address) {
            // existence checked in RpcApi
            const senderAccount = this.findWalletByAddress(this.request.sender.toUserFriendlyAddress(), true)!;
            const senderContract = senderAccount.findContractByAddress(this.request.sender);
            const signer = senderAccount.findSignerForAddress(this.request.sender)!;

            senderAddress = this.request.sender;
            senderLabel = (senderContract || signer).label;
            senderType = senderContract ? senderContract.type : Nimiq.AccountType.Basic;
            keyId = senderAccount.keyId;
            keyPath = signer.path;
            keyLabel = senderAccount.labelForKeyguard;
        } else {
            ({
                address: senderAddress,
                label: senderLabel,
                type: senderType,
                signerKeyId: keyId,
                signerKeyPath: keyPath,
                walletLabel: keyLabel,
            } = this.request.sender);
        }

        let keyguardRequest: KeyguardClient.SignTransactionRequest;

        // Check if this is a multi-transaction request
        if (this.request.transactions && this.request.transactions.length > 0) {
            // Multi-transaction format
            // Transactions can be ParsedTransactionData[] (from TransactionData[])
            // or PlainTransaction[] (from Uint8Array[])

            // If we have serialized transactions
            if (this.request.serializedTransactions) {
                // For staking transactions, re-serialize from PlainTransaction (like SignStaking does)
                const transactions = this.request.isStakingRequest && this.request.transactions
                    ? (this.request.transactions as any[]).map((plainTx: any) =>
                        Nimiq.Transaction.fromPlain(plainTx).serialize())
                    : this.request.serializedTransactions;

                if (this.request.layout === 'switch-validator') {
                    keyguardRequest = {
                        layout: 'switch-validator',
                        appName: this.request.appName,

                        keyId,
                        keyPath,
                        keyLabel,

                        senderLabel,
                        recipientLabel,

                        transactions,

                        // The validator being switched to is not passed on: the Keyguard reads it
                        // from the signed update-staker transaction, so that what it displays is
                        // what gets signed.
                        validatorImageUrl: this.request.validatorImageUrl,
                        fromValidatorAddress: this.request.fromValidatorAddress!,
                        fromValidatorImageUrl: this.request.fromValidatorImageUrl,
                    };
                } else if (this.request.layout === 'unstaking') {
                    keyguardRequest = {
                        layout: 'unstaking',
                        appName: this.request.appName,

                        keyId,
                        keyPath,
                        keyLabel,

                        senderLabel,
                        recipientLabel,

                        transactions,

                        validatorAddress: this.request.validatorAddress!,
                        validatorImageUrl: this.request.validatorImageUrl,
                    };
                } else {
                    keyguardRequest = {
                        layout: 'standard',
                        appName: this.request.appName,

                        keyId,
                        keyPath,
                        keyLabel,

                        // For staking transactions, don't include sender field (like SignStaking)
                        // For non-staking, include it
                        ...(this.request.isStakingRequest ? {} : {
                            sender: senderAddress.serialize(),
                        }),
                        senderLabel,
                        recipientLabel,

                        // For staking: re-serialized from PlainTransaction
                        // For non-staking: original serialized bytes
                        transactions,

                        // Pass through staking-specific fields (like SignStaking does)
                        ...(this.request.isStakingRequest ? {
                            validatorAddress: this.request.validatorAddress,
                            validatorImageUrl: this.request.validatorImageUrl,
                        } : {}),
                    };
                }
            } else {
                // Otherwise, convert ParsedTransactionData or PlainTransaction to TransactionData
                const firstTx = this.request.transactions[0];

                // Check if transactions are PlainTransaction[] (from serialized) or ParsedTransactionData[]
                const isPlainTransaction = typeof (firstTx as any).recipient === 'string';

                // Cast to any to avoid union type issues with map()
                const txArray = this.request.transactions as any[];

                keyguardRequest = {
                    layout: 'standard',
                    appName: this.request.appName,

                    keyId,
                    keyPath,
                    keyLabel,

                    recipientLabel,

                    transactions: txArray.map((tx: any) => {
                        if (isPlainTransaction) {
                            // PlainTransaction from serialized format
                            return {
                                sender: senderAddress.serialize(),
                                senderType: tx.senderType || senderType || Nimiq.AccountType.Basic,
                                senderLabel: tx.senderLabel || senderLabel,
                                recipient: tx.recipient, // Already a string
                                recipientType: tx.recipientType === 'basic' ? Nimiq.AccountType.Basic
                                    : tx.recipientType === 'vesting' ? Nimiq.AccountType.Vesting
                                    : tx.recipientType === 'htlc' ? Nimiq.AccountType.HTLC
                                    : tx.recipientType === 'staking' ? Nimiq.AccountType.Staking
                                    : Nimiq.AccountType.Basic,
                                recipientLabel: tx.recipientLabel,
                                recipientData: tx.data,
                                value: tx.value,
                                fee: tx.fee,
                                validityStartHeight: tx.validityStartHeight,
                                flags: tx.flags,
                            };
                        } else {
                            // ParsedTransactionData from TransactionData format
                            return {
                                sender: senderAddress.serialize(),
                                senderType: tx.senderType || senderType || Nimiq.AccountType.Basic,
                                senderLabel: tx.senderLabel || senderLabel,
                                recipient: tx.recipient.serialize(), // Nimiq.Address object
                                recipientType: tx.recipientType,
                                recipientLabel: tx.recipientLabel,
                                recipientData: tx.data,
                                value: tx.value,
                                fee: tx.fee,
                                validityStartHeight: tx.validityStartHeight,
                                flags: tx.flags,
                            };
                        }
                    }),
                };
            }
        } else {
            // Single transaction format (backward compatible)
            keyguardRequest = {
                layout: 'standard',
                appName: this.request.appName,

                keyId,
                keyPath,
                keyLabel,

                sender: senderAddress.serialize(),
                senderLabel,
                senderType: senderType || Nimiq.AccountType.Basic,
                recipient: this.request.recipient.serialize(),
                recipientType: this.request.recipientType,
                recipientLabel,
                recipientData: this.request.data,
                value: this.request.value,
                fee: this.request.fee,
                validityStartHeight: this.request.validityStartHeight,
                flags: this.request.flags,
            };
        }

        staticStore.keyguardRequest = keyguardRequest;
        const keyguardClient = this.$rpc.createKeyguardClient(true);
        keyguardClient.signTransaction(keyguardRequest);
    }
}
</script>
