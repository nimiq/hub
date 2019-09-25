import { ResponseStatus, RpcServer, State as RpcState } from '@nimiq/rpc';
import { BrowserDetection } from '@nimiq/utils';
import { RootState } from '@/store';
import { Store } from 'vuex';
import Router from 'vue-router';
import {
    ParsedCheckoutRequest,
    ParsedSignMessageRequest,
    ParsedSignTransactionRequest,
    ParsedSimpleRequest,
} from './RequestTypes';
import { RequestParser } from './RequestParser';
import { Currency, RequestType, RpcRequest, RpcResult } from './PublicRequestTypes';
import { ParsedNimiqDirectPaymentOptions } from './paymentOptions/NimiqPaymentOptions';
import { Errors as KeyguardErrors, KeyguardClient, KeyguardCommand } from '@nimiq/keyguard-client';
import { keyguardResponseRouter, REQUEST_ERROR } from '@/router';
import { StaticStore } from '@/lib/StaticStore';
import { WalletStore } from './WalletStore';
import { WalletType } from '@/lib/WalletInfo';
import CookieJar from '@/lib/CookieJar';
import { Raven } from 'vue-raven'; // Sentry.io SDK
import { ERROR_CANCELED } from './Constants';
import Config from 'config';

export default class RpcApi {
    private _server: RpcServer;
    private _store: Store<RootState>;
    private _staticStore: StaticStore;
    private _router: Router;
    private _keyguardClient: KeyguardClient;

    private _3rdPartyRequestWhitelist: RequestType[] = [
        RequestType.CHECKOUT,
        RequestType.SIGN_TRANSACTION,
        RequestType.SIGN_MESSAGE,
        RequestType.CHOOSE_ADDRESS,
    ];

    constructor(store: Store<RootState>, staticStore: StaticStore, router: Router) {
        this._store = store;
        this._staticStore = staticStore;
        this._router = router;
        this._server = new RpcServer('*');
        this._keyguardClient = new KeyguardClient(Config.keyguardEndpoint);

        this._registerAccountsApis([
            RequestType.SIGN_TRANSACTION,
            RequestType.CHECKOUT,
            RequestType.ONBOARD,
            RequestType.SIGNUP,
            RequestType.LOGIN,
            RequestType.EXPORT,
            RequestType.CHANGE_PASSWORD,
            RequestType.LOGOUT,
            RequestType.ADD_ADDRESS,
            RequestType.RENAME,
            RequestType.SIGN_MESSAGE,
            RequestType.MIGRATE,
            RequestType.CHOOSE_ADDRESS,
        ]);
        this._registerKeyguardApis([
            KeyguardCommand.SIGN_TRANSACTION,
            KeyguardCommand.CREATE,
            KeyguardCommand.IMPORT,
            KeyguardCommand.EXPORT,
            KeyguardCommand.CHANGE_PASSWORD,
            KeyguardCommand.REMOVE,
            KeyguardCommand.DERIVE_ADDRESS,
            KeyguardCommand.SIGN_MESSAGE,
        ]);
    }

    public start() {
        this._keyguardClient.init().catch(console.error); // TODO: Provide better error handling here
        if (this._store.state.keyguardResult) return;

        // If there is no valid request, show an error page
        const onClientTimeout = () => {
            this._router.replace(`/${REQUEST_ERROR}`);
        };
        this._server.init(onClientTimeout);
    }

    public createKeyguardClient(handleHistoryBack?: boolean) {
        const localState = this._exportState();
        const client = new KeyguardClient(
            Config.keyguardEndpoint,
            window.location.origin,
            localState,
            undefined, // preserveRequests: keep default behavior, which is true for redirects but false for postMessage
            handleHistoryBack,
        );
        return client;
    }

    public routerPush(routeName: string) {
        const query = this._parseUrlParams(window.location.search);
        this._router.push({name: routeName, query});
    }

    public routerReplace(routeName: string) {
        const query = this._parseUrlParams(window.location.search);
        this._router.replace({name: routeName, query});
    }

    public resolve(result: RpcResult) {
        this._reply(ResponseStatus.OK, result);
    }

    public reject(error: Error) {
        const ignoredErrorTypes = [ KeyguardErrors.Types.INVALID_REQUEST.toString() ];
        const ignoredErrors = [ ERROR_CANCELED, 'Request aborted', 'Account ID not found', 'Address not found' ];
        if (ignoredErrorTypes.indexOf(error.name) < 0 && ignoredErrors.indexOf(error.message) < 0) {
            if (Config.reportToSentry) {
                console.debug('Request:', JSON.stringify(this._staticStore.request));
                Raven.captureException(error);
            }
        }

        this._reply(ResponseStatus.ERROR, error);
    }

    public get keyguardClient(): KeyguardClient {
        return this._keyguardClient;
    }

    private async _reply(status: ResponseStatus, result: RpcResult | Error) {
        // Update cookies for iOS
        if (BrowserDetection.isIOS() || BrowserDetection.isSafari()) {
            const wallets = await WalletStore.Instance.list();
            CookieJar.fill(wallets);
        }

        // Check for originalRouteName in StaticStore and route there
        if (this._staticStore.originalRouteName && (!(result instanceof Error) || result.message !== ERROR_CANCELED)) {
            this._staticStore.sideResult = result;
            this._store.commit('setKeyguardResult', null);

            // Recreate original URL with original query parameters
            const rpcState = this._staticStore.rpcState!;
            const query = { rpcId: rpcState.id.toString() };
            this._router.push({ name: this._staticStore.originalRouteName, query });
            delete this._staticStore.originalRouteName;
            return;
        }

        this._staticStore.rpcState!.reply(status, result);
    }

    private _exportState(): any {
        return {
            rpcState: this._staticStore.rpcState ? this._staticStore.rpcState.toJSON() : undefined,
            request: this._staticStore.request ? RequestParser.raw(this._staticStore.request) : undefined,
            kind: this._staticStore.request ? this._staticStore.request.kind : undefined,
            keyguardRequest: this._staticStore.keyguardRequest,
            originalRouteName: this._staticStore.originalRouteName,
        };
    }

    private _registerAccountsApis(requestTypes: RequestType[]) {
        for (const requestType of requestTypes) {
            // Server listener
            this._server.onRequest(requestType, async (state, arg: RpcRequest) => {
                let request;

                if (!this._3rdPartyRequestWhitelist.includes(requestType)) {
                    // Check that a non-whitelisted request comes from a privileged origin
                    if (!Config.privilegedOrigins.includes(state.origin)
                        && !Config.privilegedOrigins.includes('*')) {
                        state.reply(ResponseStatus.ERROR, new Error('Unauthorized'));
                        return;
                    }
                }

                this._staticStore.rpcState = state;
                try {
                    request = RequestParser.parse(arg, state, requestType) || undefined;
                    this._staticStore.request = request;
                } catch (error) {
                    this.reject(error);
                    return;
                }

                const wallets = await WalletStore.Instance.list();
                if (!wallets.length) {
                    const hasLegacyAccounts = (await this._keyguardClient.hasLegacyAccounts()).success;
                    if (hasLegacyAccounts) {
                        // Keyguard has legacy accounts, redirect to migration
                        if (requestType !== RequestType.MIGRATE) {
                            this._staticStore.originalRouteName = requestType;
                        }
                        this.routerReplace(RequestType.MIGRATE);
                        this._startRoute();
                        return;
                    }
                }

                let account;
                // Simply testing if the property exists (with `'walletId' in request`) is not enough,
                // as `undefined` also counts as existing.
                if (request) {
                    let accountRequired;
                    if ((request as ParsedSimpleRequest).walletId) {
                        accountRequired = true;
                        account = await WalletStore.Instance.get((request as ParsedSimpleRequest).walletId);
                    } else if (requestType === RequestType.SIGN_TRANSACTION) {
                        accountRequired = true;
                        const address = (request as ParsedSignTransactionRequest).sender;
                        account = this._store.getters.findWalletByAddress(address.toUserFriendlyAddress(), true);
                    } else if (requestType === RequestType.SIGN_MESSAGE) {
                        accountRequired = false; // Sign message allows user to select an account
                        const address = (request as ParsedSignMessageRequest).signer;
                        if (address) {
                            account = this._store.getters.findWalletByAddress(address.toUserFriendlyAddress(), false);
                        }
                    } else if (requestType === RequestType.CHECKOUT) {
                        const checkoutRequest = request as ParsedCheckoutRequest;
                        // forceSender only applies to non-multi-currency checkouts.
                        if (checkoutRequest.paymentOptions.length === 1
                            && checkoutRequest.paymentOptions[0].currency === Currency.NIM) {

                            /**
                             * Later on can potentially be ParsedNimiqOasisPaymentOptions.
                             * If it will contain the forceSender flag as well it should not be an issue.
                             */
                            const protocolSpecific =
                                (checkoutRequest.paymentOptions[0] as ParsedNimiqDirectPaymentOptions).protocolSpecific;

                            accountRequired = protocolSpecific.forceSender;
                            if (protocolSpecific.sender) {
                                account = this._store.getters.findWalletByAddress(
                                    protocolSpecific.sender.toUserFriendlyAddress(),
                                    true,
                                );
                            }
                        }
                    }
                    if (accountRequired && !account) {
                        this.reject(new Error('Account not found'));
                        return;
                    }
                }

                this._startRoute();

                if (location.pathname !== '/') {
                    // Don't jump back to request's initial view on reload when navigated to a subsequent view.
                    // E.g. if the user switches from Checkout to Import, don't jump back to Checkout on reload.
                    return;
                }

                if (account && account.type === WalletType.LEDGER
                    && this._router.getMatchedComponents({ name: `${requestType}-ledger` }).length > 0) {
                    this.routerReplace(`${requestType}-ledger`);
                } else {
                    this.routerReplace(requestType);
                }
            });
        }
    }

    private _parseUrlParams(query: string) {
        const params: {[key: string]: string} = {};
        if (!query) return params;
        const keyValues = query.substr(1).replace(/\+/g, ' ').split('&')
            .map((keyValueString) => keyValueString.split('='));

        for (const keyValue of keyValues) {
            // @ts-ignore Property 'decodeURIComponent' does not exist on type 'Window'
            params[keyValue[0]] = window.decodeURIComponent(keyValue[1]);
        }

        return params;
    }

    private _recoverState(storedState: any) {
        const rpcState = RpcState.fromJSON(storedState.rpcState);
        const request = RequestParser.parse(storedState.request, rpcState, storedState.kind);
        const keyguardRequest = storedState.keyguardRequest;
        const originalRouteName = storedState.originalRouteName;

        this._staticStore.rpcState = rpcState;
        this._staticStore.request = request || undefined;
        this._staticStore.keyguardRequest = keyguardRequest;
        this._staticStore.originalRouteName = originalRouteName;
    }

    private _registerKeyguardApis(commands: KeyguardCommand[]) {
        for (const command of commands) {
            // Server listener
            this._keyguardClient.on(command, (result, state) => {
                // Recover state
                this._recoverState(state);

                // Set result
                this._store.commit('setKeyguardResult', result);

                // To enable the keyguardResponseRouter to decide correctly to which route it should direct
                // when returning from the Keyguard's sign-transaction request, the original request kind that
                // was given to the Hub is passed here and the keyguardResponseRouter is turned
                // from an object into a function instead.
                this.routerReplace(keyguardResponseRouter(command, this._staticStore.request!.kind).resolve);

                this._startRoute();
            }, (error, state?: any) => {
                // Recover state
                this._recoverState(state);

                // Set result
                this._store.commit('setKeyguardResult', error);

                if (error.message === KeyguardErrors.Messages.CANCELED) {
                    this.reject(error);
                    return;
                }

                if (error.message === 'Request aborted') {
                    /*
                     * In case the window is a popup and the recovered state is the one with which the popup was
                     * initialized (has a source), then reject it. The popup will be closed as a result.
                     * If not, there was another history entry in between, where a history.back() will navigate to,
                     * not closing the popup in the process.
                     */
                    if (this._staticStore.rpcState!.source && window.opener) {
                        this.reject(error);
                    } else {
                        window.history.back();
                    }
                    return;
                }

                this._startRoute();

                if (error.message === KeyguardErrors.Messages.EXPIRED) {
                    // Don't reject but navigate to checkout to display the expiration warning there.
                    this.routerReplace(RequestType.CHECKOUT);
                    return;
                }

                this.routerReplace(keyguardResponseRouter(command, this._staticStore.request!.kind).reject);
            });
        }
    }

    private _startRoute() {
        this._store.commit('setIncomingRequest', {
            hasRpcState: !!this._staticStore.rpcState,
            hasRequest: !!this._staticStore.request,
        });
    }
}
