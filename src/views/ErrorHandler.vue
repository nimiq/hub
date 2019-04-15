<template></template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { State } from 'vuex-class';
import staticStore, { Static } from '../lib/StaticStore';
import { ParsedRpcRequest, ParsedSimpleRequest, RequestType } from '../lib/RequestTypes';
import { Errors } from '@nimiq/keyguard-client';
import { WalletStore } from '../lib/WalletStore';
import KeyguardClient from '@nimiq/keyguard-client';
import { DEFAULT_KEY_PATH } from '../lib/Constants';

@Component
export default class ErrorHandler extends Vue {
    @Static protected request!: ParsedRpcRequest;
    @Static protected keyguardRequest?: KeyguardClient.Request;
    @State protected keyguardResult!: Error;

    public async created() {
        if (!(this.keyguardResult instanceof Error)) return;
        if (this.requestSpecificErrors()) return;
        if (this.keyguardResult.message === Errors.Messages.KEY_NOT_FOUND) {
            let walletId: string;
            if ((this.request as ParsedSimpleRequest).walletId) {
                // The walletId is already in the Accounts request
                walletId = (this.request as ParsedSimpleRequest).walletId;
            } else if (this.request.kind === RequestType.CHECKOUT
                    || this.request.kind === RequestType.SIGN_MESSAGE) {
                // Accounts request was Checkout/SignMessage.
                // The walletId (keyId in the Keyguard environment) is in the keyguardRequest after picking the account
                walletId = (this.keyguardRequest as KeyguardClient.SignTransactionRequest).keyId;
            } else {
                // This really should not happen.
                // Executing this code would mean i.e. a CreateRequest fired KEY_NOT_FOUND which it does not throw
                this.$rpc.reject(this.keyguardResult);
                return;
            }

            const walletInfo = await WalletStore.Instance.get(walletId);
            if (!walletInfo) {
                this.$rpc.reject(this.keyguardResult); // return it to caller
                return;
            }
            walletInfo.keyMissing = true;
            await WalletStore.Instance.put(walletInfo);

            // Redirect to login
            staticStore.originalRouteName = this.request.kind;

            const request: KeyguardClient.ImportRequest = {
                appName: this.request.appName,
                requestedKeyPaths: [DEFAULT_KEY_PATH],
                isKeyLost: true,
            };

            const client = this.$rpc.createKeyguardClient();
            client.import(request);

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
