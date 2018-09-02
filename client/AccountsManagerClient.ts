import {PopupRequestBehavior, RequestBehavior} from './RequestBehavior';
import {RedirectRpcClient} from '@nimiq/rpc';
import {SignupRequest, CheckoutRequest, RequestType} from '@/lib/RequestTypes';

export default class AccountsManagerClient {
    private static readonly DEFAULT_ENDPOINT = '../src';

    private readonly _endpoint: string;
    private readonly  _defaultBehavior: RequestBehavior;
    private readonly  _redirectClient: RedirectRpcClient;
    private readonly _observable: Nimiq.Observable;

    constructor(endpoint: string = AccountsManagerClient.DEFAULT_ENDPOINT, defaultBehavior?: RequestBehavior) {
        this._endpoint = endpoint;
        this._defaultBehavior = defaultBehavior || new PopupRequestBehavior();

        this._redirectClient = new RedirectRpcClient('', RequestBehavior.getAllowedOrigin(this._endpoint));
        this._redirectClient.onResponse('request', this._onResolve.bind(this), this._onReject.bind(this));

        this._observable = new Nimiq.Observable();
    }

    public init() {
        return this._redirectClient.init();
    }

    public on(command: RequestType, resolve: (...args: any[]) => any, reject: (...args: any[]) => any) {
        this._observable.on(`${command}-resolve`, resolve);
        this._observable.on(`${command}-reject`, reject);
    }

    public create(request: SignupRequest, requestBehavior = this._defaultBehavior) {
        return this._request(requestBehavior, RequestType.SIGNUP, [request]);
    }

    public checkout(request: CheckoutRequest, requestBehavior = this._defaultBehavior) {
        return this._request(requestBehavior, RequestType.CHECKOUT, [request]);
    }

    public createPopup(options: string) {
        const behavior = new PopupRequestBehavior(options);
        return behavior.createPopup(this._endpoint);
    }

    /* PRIVATE METHODS */

    private _request(behavior: RequestBehavior, command: RequestType, args: any[]) {
        return behavior.request(this._endpoint, command, args);
    }

    private _onReject(error: any, id: number, state: any) {
        const command = state.__command;
        if (!command) {
            throw new Error('Invalid state after RPC request');
        }
        delete state.__command;

        this._observable.fire(`${command}-reject`, error, state);
    }

    private _onResolve(result: any, id: number, state: any) {
        const command = state.__command;
        if (!command) {
            throw new Error('Invalid state after RPC request');
        }
        delete state.__command;

        this._observable.fire(`${command}-resolve`, result, state);
    }
}
