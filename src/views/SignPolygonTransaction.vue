<template></template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { ParsedSignPolygonTransactionRequest } from '../lib/RequestTypes';
import KeyguardClient from '@nimiq/keyguard-client';
import staticStore, { Static } from '../lib/StaticStore';
import { WalletInfo } from '../lib/WalletInfo';
import { Getter } from 'vuex-class';

@Component
export default class SignPolygonTransaction extends Vue {
    @Static private request!: ParsedSignPolygonTransactionRequest;
    @Getter private findWalletByPolygonAddress!: (address: string) => WalletInfo | undefined;

    public async created() {
        // Forward user through Hub to Keyguard

        let keyId: string;
        let keyPath: string;
        let keyLabel: string;

        if (typeof this.request.request.from === 'string') {
            // existence checked in RpcApi
            const senderAccount = this.findWalletByPolygonAddress(this.request.request.from)!;
            const from = this.request.request.from.toLowerCase();
            const signer = senderAccount.polygonAddresses.find((ai) => ai.address.toLowerCase() === from)!;

            keyId = senderAccount.keyId;
            keyPath = signer.path;
            keyLabel = senderAccount.labelForKeyguard!;
        } else {
            ({
                signerKeyId: keyId,
                signerKeyPath: keyPath,
                walletLabel: keyLabel,
            } = this.request.request.from);
        }

        // Forward only the known fields
        const request: KeyguardClient.SignPolygonTransactionRequest = this.request.operation === 'transfer' ? {
            appName: this.request.appName,
            keyId,
            keyPath,
            keyLabel,
            request: this.request.request,
            tokenNonce: this.request.tokenNonce,
            corrects: this.request.corrects,
            recipientLabel: this.request.recipientLabel,
        } : {
            appName: this.request.appName,
            keyId,
            keyPath,
            keyLabel,
            operation: this.request.operation,
            request: this.request.request,
            token: this.request.token,
            amount: this.request.amount,
            senderLabel: this.request.senderLabel,
        };

        staticStore.keyguardRequest = request;

        const client = this.$rpc.createKeyguardClient(true);
        client.signPolygonTransaction(request);
    }
}
</script>
