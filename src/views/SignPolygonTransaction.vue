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

        const from = this.request.request.from.toLowerCase();
        // existence checked in RpcApi
        const senderAccount = this.findWalletByPolygonAddress(from)!;
        const signer = senderAccount.polygonAddresses.find((ai) => ai.address.toLowerCase() === from)!;

        const request: KeyguardClient.SignPolygonTransactionRequest = {
            appName: this.request.appName,
            keyId: senderAccount.keyId,
            keyPath: signer.path,
            keyLabel: senderAccount.labelForKeyguard!,
            request: this.request.request,
            tokenNonce: this.request.tokenNonce,
            corrects: this.request.corrects,
            recipientLabel: this.request.recipientLabel,
        };

        staticStore.keyguardRequest = request;

        const client = this.$rpc.createKeyguardClient(true);
        client.signPolygonTransaction(request);
    }
}
</script>
