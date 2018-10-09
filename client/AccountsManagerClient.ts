import {PopupRequestBehavior, IFrameRequestBehavior, RequestBehavior} from './RequestBehavior';
import Observable from './Observable';
import {RedirectRpcClient} from '@nimiq/rpc';
import {
    RequestType,
    SignupRequest,
    SignupResult,
    CheckoutRequest,
    LoginRequest,
    LoginResult,
    LogoutRequest,
    LogoutResult,
    SignTransactionRequest,
    SignTransactionResult,
    // ListResult,
} from '../src/lib/RequestTypes';

export default class AccountsManagerClient {
    private static readonly DEFAULT_ENDPOINT =
    window.location.origin === 'https://safe-next.nimiq.com' ? 'https://accounts.nimiq.com'
    : window.location.origin === 'https://safe-next.nimiq-testnet.com' ? 'https://accounts.nimiq-testnet.com'
    : 'http://localhost:8080';

    private readonly _endpoint: string;
    private readonly _defaultBehavior: RequestBehavior;
    private readonly _iframeBehavior: IFrameRequestBehavior;
    private readonly _redirectClient: RedirectRpcClient;
    private readonly _observable: Observable;

    constructor(endpoint: string = AccountsManagerClient.DEFAULT_ENDPOINT, defaultBehavior?: RequestBehavior) {
        this._endpoint = endpoint;
        this._defaultBehavior = defaultBehavior || new PopupRequestBehavior(
            `left=${window.innerWidth / 2 - 500},top=50,width=1000,height=900,location=yes,dependent=yes`);
        this._iframeBehavior = new IFrameRequestBehavior();

        // Check for RPC results in the URL
        this._redirectClient = new RedirectRpcClient('', RequestBehavior.getAllowedOrigin(this._endpoint));

        this._observable = new Observable();
    }

    public init() {
        return this._redirectClient.init();
    }

    public on(command: RequestType, resolve: (...args: any[]) => any, reject: (...args: any[]) => any) {
        this._redirectClient.onResponse(command, resolve, reject);
    }

    public signup(request: SignupRequest, requestBehavior = this._defaultBehavior): Promise<SignupResult> {
        return this._request(requestBehavior, RequestType.SIGNUP, [request]);
    }

    public signTransaction(
        request: SignTransactionRequest,
        requestBehavior = this._defaultBehavior,
    ): Promise<SignTransactionResult> {
        return this._request(requestBehavior, RequestType.SIGNTRANSACTION, [request]);
    }

    public checkout(request: CheckoutRequest, requestBehavior = this._defaultBehavior): Promise<SignTransactionResult> {
        return this._request(requestBehavior, RequestType.CHECKOUT, [request]);
    }

    public login(request: LoginRequest, requestBehavior = this._defaultBehavior): Promise<LoginResult> {
        return this._request(requestBehavior, RequestType.LOGIN, [request]);
    }

    public logout(request: LogoutRequest, requestBehavior = this._defaultBehavior): Promise<LogoutResult> {
        return this._request(requestBehavior, RequestType.LOGOUT, [request]);
    }

    public list(requestBehavior = this._iframeBehavior)/*: Promise<ListResult> */ {
        return this._request(requestBehavior, RequestType.LIST, []);
    }

    // END API

    /* PRIVATE METHODS */

    private _request(behavior: RequestBehavior, command: RequestType, args: any[]) {
        return behavior.request(this._endpoint, command, args);
    }
}
