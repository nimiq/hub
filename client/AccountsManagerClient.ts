import {PopupRequestBehavior, IFrameRequestBehavior, RequestBehavior} from './RequestBehavior';
// import {RedirectRpcClient} from '@nimiq/rpc';
import {SignupRequest, CheckoutRequest, LoginRequest, RequestType} from '../src/lib/RequestTypes';

export default class AccountsManagerClient {
    private static readonly DEFAULT_ENDPOINT = '../src';

    private readonly _endpoint: string;
    private readonly _popupBehavior: PopupRequestBehavior;
    private readonly _iframeBehavior: IFrameRequestBehavior;
    // private readonly _redirectClient: RedirectRpcClient;
    // private readonly _observable: Nimiq.Observable;

    constructor(endpoint: string = AccountsManagerClient.DEFAULT_ENDPOINT) {
        this._endpoint = endpoint;
        this._popupBehavior = new PopupRequestBehavior(
            `left=${window.innerWidth / 2 - 500},top=50,width=1000,height=900,location=yes,dependent=yes`);
        this._iframeBehavior = new IFrameRequestBehavior();

        // this._redirectClient = new RedirectRpcClient('', RequestBehavior.getAllowedOrigin(this._endpoint));
        // this._redirectClient.onResponse('request', this._onResolve.bind(this), this._onReject.bind(this));

        // this._observable = new Nimiq.Observable();
    }

    // public init() {
    //     return this._redirectClient.init();
    // }

    // public on(command: RequestType, resolve: (...args: any[]) => any, reject: (...args: any[]) => any) {
    //     this._observable.on(`${command}-resolve`, resolve);
    //     this._observable.on(`${command}-reject`, reject);
    // }

    public signup(request: SignupRequest, requestBehavior = this._popupBehavior) {
        return this._request(requestBehavior, RequestType.SIGNUP, [request]);
    }

    public checkout(request: CheckoutRequest, requestBehavior = this._popupBehavior) {
        return this._request(requestBehavior, RequestType.CHECKOUT, [request]);
    }

    public login(request: LoginRequest, requestBehavior = this._popupBehavior) {
        return this._request(requestBehavior, RequestType.LOGIN, [request]);
    }

    public list(requestBehavior = this._iframeBehavior) {
        return this._request(requestBehavior, RequestType.LIST, []);
    }

    // END API

    /* PRIVATE METHODS */

    private _request(behavior: RequestBehavior, command: RequestType, args: any[]) {
        return behavior.request(this._endpoint, command, args);
    }

    // private _onReject(error: any, id: number, state: any) {
    //     const command = state.__command;
    //     if (!command) {
    //         throw new Error('Invalid state after RPC request');
    //     }
    //     delete state.__command;

    //     this._observable.fire(`${command}-reject`, error, state);
    // }

    // private _onResolve(result: any, id: number, state: any) {
    //     const command = state.__command;
    //     if (!command) {
    //         throw new Error('Invalid state after RPC request');
    //     }
    //     delete state.__command;

    //     this._observable.fire(`${command}-resolve`, result, state);
    // }
}
