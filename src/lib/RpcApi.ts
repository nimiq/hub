import {RpcServer} from "@nimiq/rpc";
import {RootState} from "@/store";
import {Store} from "vuex";
import Router from 'vue-router';
import {CheckoutRequest, RequestType} from "@/lib/Requests";

export default class RpcApi {
    private _server: RpcServer;
    private _store: Store<RootState>;
    private _router: Router;

    constructor(store: Store<RootState>, router: Router) {
        this._store = store;
        this._router = router;
        this._server = new RpcServer('*');

        this._registerApis();
    }

    private _registerApis() {
        // Checkout API
        this._server.onRequest(RequestType.CHECKOUT, async (state, arg: CheckoutRequest) => {
            this._store.commit('setIncomingRequest', {
                rpcState: state,
                request: {
                    kind: RequestType.CHECKOUT,
                    recipient: new Nimiq.Address(arg.recipient),
                    recipientType: arg.recipientType,
                    value: arg.value,
                    fee: arg.fee,
                    data: arg.data,
                    flags: arg.flags,
                    networkId: arg.networkId
                }
            });
            this._router.push(RequestType.CHECKOUT);
        });
    }

    start() {
        this._server.init();
    }
}
