<template></template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { State } from 'vuex-class';
import { Static } from '../lib/StaticStore';
import { ParsedRpcRequest, ParsedExportRequest, RequestType } from '../lib/RequestTypes';
import { Errors, SignTransactionRequest } from '@nimiq/keyguard-client';
import { WalletStore } from '../lib/WalletStore';

@Component
export default class ErrorHandler extends Vue {
    @Static protected request!: ParsedRpcRequest;
    @Static protected keyguardRequest?: KeyguardRequest.KeyguardRequest;
    @State protected keyguardResult!: Error;

    public async created() {
        if (!(this.keyguardResult instanceof Error)) return;
        if (this.requestSpecificErrors()) return;
        if (this.keyguardResult.message === Errors.Messages.KEY_ID_NOT_FOUND) {
            let walletId;
            if ((this.request as ParsedExportRequest).walletId !== undefined) {
                // walletId is already in the AccountsManagerRequest
                walletId = (this.request as ParsedExportRequest).walletId;
            } else if (this.request.kind === RequestType.CHECKOUT
                    && this.keyguardRequest as KeyguardRequest.SignTransactionRequest
                    && (this.keyguardRequest as KeyguardRequest.SignTransactionRequest).layout === 'checkout' || (
                        this.request.kind === RequestType.SIGN_MESSAGE
                        && this.keyguardRequest as KeyguardRequest.SignTransactionRequest)) {
                // Accounts Request was Checkout/SignMessage. The keyId i in thse KeyguardRequest after the account was choosen
                walletId = (this.keyguardRequest as KeyguardRequest.SignTransactionRequest).keyId;
            } else {
                // this really should not happen
                // Executing this code would mean a CreateRequest (which does not fire KEY_ID_NOT_FOUND) did fire it anyways
                this.$rpc.reject(this.keyguardResult);
                return;
            }
            const walletInfo = await WalletStore.Instance.get(walletId);
            walletInfo.deleted = true;
            await WalletStore.Instance.put(walletInfo);
            this.$rpc.reject(this.keyguardResult); // return it to caller
            return;
        }
        // TODO more Error Handling

        this.$rpc.reject(this.keyguardResult);
        return;
    }

    /**
     * use this in derived classes in case a specific error needs special handling.
     */
    protected requestSpecificErrors(): boolean {
        return false;
    }
}
</script>
