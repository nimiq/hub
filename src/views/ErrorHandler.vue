<template></template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { State } from 'vuex-class';
import { Static } from '../lib/StaticStore';
import { ParsedRpcRequest, ParsedExportRequest, RequestType } from '../lib/RequestTypes';
import { Errors } from '@nimiq/keyguard-client';
import { WalletStore } from '../lib/WalletStore';

@Component
export default class ErrorHandler extends Vue {
    @Static protected request!: ParsedRpcRequest;
    @Static protected keyguardRequest?: KeyguardRequest.KeyguardRequest;
    @State protected keyguardResult!: Error;

    public async created() {
        if (!(this.keyguardResult instanceof Error)) return;
        if (this.requestSpecificErrors()) return;
        if (this.keyguardResult.message === Errors.Messages.KEY_NOT_FOUND) {
            let walletId;
            // ParsedExportRequest is just one request that has a walletId. Any of those would do.
            if ((this.request as ParsedExportRequest).walletId) {
                // The walletId is already in the Accounts request
                walletId = (this.request as ParsedExportRequest).walletId;
            } else if (this.request.kind === RequestType.CHECKOUT
                    || this.request.kind === RequestType.SIGN_MESSAGE) {
                // Accounts request was Checkout/SignMessage.
                // The walletId (keyId in the Keyguard environment) is in the keyguardRequest after picking the account
                walletId = (this.keyguardRequest as KeyguardRequest.SignTransactionRequest).keyId;
            } else {
                // This really should not happen.
                // Executing this code would mean i.e. a CreateRequest fired KEY_ID_NOT_FOUND which it does not throw
                this.$rpc.reject(this.keyguardResult);
                return;
            }
            const walletInfo = await WalletStore.Instance.get(walletId);
            if (walletInfo) {
                walletInfo.keyMissing = true;
                await WalletStore.Instance.put(walletInfo);
            }
            // TODO visuals
            this.$rpc.reject(this.keyguardResult); // return it to caller
            return;
        }
        // TODO more Error Handling

        this.$rpc.reject(this.keyguardResult);
    }

    /**
     * use this in derived classes in case a specific error needs special handling.
     */
    protected requestSpecificErrors(): boolean {
        return false;
    }
}
</script>
