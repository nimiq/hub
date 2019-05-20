<template>
    <div class="container pad-bottom">
        <SmallPage>
            <Loader
                :title="title"
                :state="state"
                :lightBlue="true"
                :mainAction="action"
                @main-action="() => report(true)"
                :message="message"
                :alternativeAction="altAction"
                @alternativeAction="report" />
        </SmallPage>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { SmallPage } from '@nimiq/vue-components';
import { State } from 'vuex-class';
import staticStore, { Static } from '../lib/StaticStore';
import { ParsedRpcRequest, ParsedSimpleRequest, RequestType } from '../lib/RequestTypes';
import { Errors } from '@nimiq/keyguard-client';
import { WalletStore } from '../lib/WalletStore';
import Loader from '@/components/Loader.vue';
import KeyguardClient from '@nimiq/keyguard-client';
import { Raven } from 'vue-raven'; // Sentry.io SDK
import { DEFAULT_KEY_PATH, ERROR_CANCELED } from '../lib/Constants';

@Component({components: {Loader, SmallPage}})
export default class ErrorHandler extends Vue {
    @Static protected request!: ParsedRpcRequest;
    @Static protected keyguardRequest?: KeyguardClient.Request;
    @State protected keyguardResult!: Error;

    private state: Loader.State = Loader.State.LOADING;
    private title: string = '';
    private message: string = '';
    private action: string = '';
    private altAction: string = '';

    public async created() {
        if (!(this.keyguardResult instanceof Error)) return;

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

        if (this.keyguardResult.message === Errors.Messages.GOTO_CREATE) {
            this.$rpc.routerReplace(RequestType.SIGNUP);
            return;
        }

        // TODO more Error Handling

        if (this.responseErrorOnReportingBlacklist()) {
            this.$rpc.reject(this.keyguardResult);
            return;
        }

        this.state = Loader.State.ERROR;
        this.title = 'An Error Occured';
        this.message = 'Help us improve by reporting this Error.';
        this.action = 'Report';
        this.altAction = 'No, Thanks!';

    }

    private report(doReport = false) {
        console.debug('Request:', JSON.stringify(this.keyguardRequest));
        if (doReport) {
            Raven.captureException(this.keyguardResult);
        }
        this.$rpc.reject(this.keyguardResult);
    }

    private responseErrorOnReportingBlacklist(): boolean {
        // TODO improve error blacklist
        const ignoredErrorTypes = [ Errors.Types.INVALID_REQUEST.toString() ];
        const ignoredErrors = [ ERROR_CANCELED, 'Request aborted', 'Account ID not found', 'Address not found' ];
        return !(ignoredErrorTypes.indexOf(this.keyguardResult.name) < 0
            && ignoredErrors.indexOf(this.keyguardResult.message) < 0);
    }
}
</script>
