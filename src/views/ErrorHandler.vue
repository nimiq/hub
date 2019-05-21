<template>
    <div class="container pad-bottom">
        <SmallPage>
            <Loader
                :title="title"
                :state="state"
                :lightBlue="true"
                :mainAction="mainAction"
                @main-action="mainActionHandler"
                :message="message"
                :alternativeAction="altAction"
                @alternative-action="altActionHandler" />
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
    @Static protected error?: Error;
    @State protected keyguardResult!: Error;

    private state: Loader.State = Loader.State.LOADING;
    private title: string = '';
    private message: string = '';
    private mainAction: string = 'Close window';
    private altAction: string = '';

    public async created() {
        let error: Error | null = null;
        if (this.keyguardResult instanceof Error) {
            error = this.keyguardResult;
        } else if (this.error instanceof Error) {
            error = this.error;
        }
        if (!(error instanceof Error)) return;

        if (error.message === Errors.Messages.KEY_NOT_FOUND) {
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
                this.$rpc.reject(error);
                return;
            }

            const walletInfo = await WalletStore.Instance.get(walletId);
            if (!walletInfo) {
                this.$rpc.reject(error); // return it to caller
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

        if (error.message === Errors.Messages.GOTO_CREATE) {
            this.$rpc.routerReplace(RequestType.SIGNUP);
            return;
        }

        // TODO more Error Handling
        if (this.rejectError(error)) {
            if (this.obfuscateError(error)) {
                this.$rpc.reject(new Error('Request aborted'));
                return;
            } else {
                this.$rpc.reject(error);
                return;
            }
        }

        this.state = Loader.State.ERROR;
        this.title = 'An error occurred';

        if (this.reportError(error)) {
            this.message = 'Help us improve by reporting this Error.';
            this.mainAction = 'Report';
            this.mainActionHandler = () => {
                // Raven.captureException(this.keyguardResult);
                // this.$rpc.reject(error!);
                this.$rpc.reject(new Error('captured'));
            };
            this.altAction = 'Close window';
            this.altActionHandler = () => {
                this.$rpc.reject(error!);
                console.log('trying to reject');
            };
        } else {
            this.mainAction = 'Close window';
            this.mainActionHandler = () => this.$rpc.reject(error!);
        }
    }

    /**
     * Errors that return true when provided as argument to this function
     * will immediately be rejected.
     */
    private rejectError(error: Error) {
        const ignoredErrorTypes = [ Errors.Types.INVALID_REQUEST.toString() ];
        const ignoredErrors = [ ERROR_CANCELED, 'Request aborted', 'Account ID not found', 'Address not found' ];
        return ignoredErrorTypes.indexOf(error.name) > 0
            && ignoredErrors.indexOf(error.message) > 0;
    }

    /**
     * Errors that return true when provided as argument to this function
     * will reject with an `new Error('Request aborted`)`
     */
    private obfuscateError(error: Error) {
        return false;
    }

    /**
     * Errors that return true when provided as argument to this function
     * will provide the option to be reported to sentry
     */
    private reportError(error: Error): boolean {
        return true;
    }

    private mainActionHandler: () => void = () => {}; // tslint:disable-line:no-empty
    private altActionHandler: () => void = () => {}; // tslint:disable-line:no-empty
}
</script>
