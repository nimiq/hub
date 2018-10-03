import {RpcServer, State as RpcState, ResponseStatus} from '@nimiq/rpc';
import {RootState} from '@/store';
import {Store} from 'vuex';
import Router from 'vue-router';
import {AccountsRequest, RequestType, RpcRequest} from '@/lib/RequestTypes';
import {KeyguardCommand, RequestBehavior, KeyguardClient} from '@nimiq/keyguard-client';
import {keyguardResponseRouter} from '@/router';
import {StaticStore} from '@/lib/StaticStore';

export default class RpcApi {

    public static createKeyguardClient(store: Store<RootState>, staticStore: StaticStore, endpoint?: string) {
        const behavior = new RequestBehavior(undefined, RpcApi.exportState(store, staticStore));
        const client = new KeyguardClient(endpoint, behavior);
        return client;
    }

    private static exportState(store: Store<RootState>, staticStore: StaticStore): any {
        return {
            rpcState: staticStore.rpcState ? staticStore.rpcState.toJSON() : undefined,
            request: staticStore.request ? AccountsRequest.raw(staticStore.request) : undefined,
            keyguardRequest: staticStore.keyguardRequest,
        };
    }

    private _server: RpcServer;
    private _store: Store<RootState>;
    private _staticStore: StaticStore;
    private _router: Router;
    private _keyguardClient: KeyguardClient;

    constructor(store: Store<RootState>, staticStore: StaticStore, router: Router) {
        this._store = store;
        this._staticStore = staticStore;
        this._router = router;
        this._server = new RpcServer('*');
        this._keyguardClient = new KeyguardClient();

        this._registerAccountsApis([
            RequestType.SIGNTRANSACTION,
            RequestType.CHECKOUT,
            RequestType.SIGNUP,
            RequestType.LOGIN,
        ]);
        this._registerKeyguardApis([
            KeyguardCommand.SIGN_TRANSACTION,
            KeyguardCommand.CREATE,
            KeyguardCommand.IMPORT,
        ]);
    }

    public start() {
        this._server.init();
        this._keyguardClient.init().catch(console.error); // TODO: Provide better error handling here
    }

    private _registerAccountsApis(requests: RequestType[]) {
        for (const request of requests) {
            // Server listener
            this._server.onRequest(request, async (state, arg: RpcRequest) => {
                this._staticStore.rpcState = state;
                this._staticStore.request = AccountsRequest.parse(arg, request) || undefined;

                this._store.commit('setIncomingRequest', {
                    hasRpcState: !!this._staticStore.rpcState,
                    hasRequest: !!this._staticStore.request,
                });
                this._router.push({name: request});
            });
        }
    }

    private _recoverState(state: any) {
        const rpcState = RpcState.fromJSON(state.rpcState);
        const request = AccountsRequest.parse(state.request);
        const keyguardRequest = state.keyguardRequest;

        this._staticStore.rpcState = rpcState;
        this._staticStore.request = request || undefined;
        this._staticStore.keyguardRequest = keyguardRequest;

        this._store.commit('setIncomingRequest', {
            hasRpcState: !!this._staticStore.rpcState,
            hasRequest: !!this._staticStore.request,
        });
    }

    private _registerKeyguardApis(commands: KeyguardCommand[]) {
        for (const command of commands) {
            // Server listener
            this._keyguardClient.on(command, (result, state) => {
                // Recover state
                this._recoverState(state);

                // Set result
                result.kind = command;
                this._store.commit('setKeyguardResult', result);

                // To enable the keyguardResponseRouter to decide correctly to which route it should direct
                // when returning from the Keyguard's sign-transaction request, the original request kind that
                // was given to the AccountsManager is passed here and the keyguardResponseRouter is turned
                // from an object into a function instead.
                this._router.push({name: keyguardResponseRouter(command, this._staticStore.request!.kind).resolve});
            }, (error, state) => {
                // Recover state
                this._recoverState(state);

                if (error.message === 'CANCEL') {
                    this._staticStore.rpcState!.reply(ResponseStatus.ERROR, error);
                    return;
                }

                // Set result
                this._store.commit('setKeyguardResult', error);

                this._router.push({name: keyguardResponseRouter(command, this._staticStore.request!.kind).reject});
            });
        }
    }
}
