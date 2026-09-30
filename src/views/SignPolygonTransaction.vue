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

        const request: KeyguardClient.SignPolygonTransactionRequest = 'relayData' in this.request ? {
            ...this.request,
            keyId,
            keyPath,
            keyLabel,
        } : {
            // Gasless transfer: forward only the known fields
            appName: this.request.appName,
            keyId,
            keyPath,
            keyLabel,
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
