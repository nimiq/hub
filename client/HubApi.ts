import {
    PopupRequestBehavior,
    IFrameRequestBehavior,
    RequestBehavior,
    RedirectRequestBehavior,
    BehaviorType,
} from './RequestBehavior';
import { RedirectRpcClient } from '@nimiq/rpc';
import { RequestType } from '../src/lib/RequestTypes';
import {
    BasicRequest,
    SimpleRequest,
    CheckoutRequest,
    SignTransactionRequest,
    RenameRequest,
    SignMessageRequest,
    ExportRequest,
    ResultByRequestType,
    Account,
    Address,
    SignedTransaction,
    SimpleResult,
    ExportResult,
    SignedMessage,
} from '../src/lib/PublicRequestTypes';

export default class HubApi<DB extends BehaviorType = BehaviorType.POPUP> { // DB: Default Behavior
    public static readonly RequestType = RequestType;
    public static readonly RedirectRequestBehavior = RedirectRequestBehavior;
    public static readonly MSG_PREFIX = '\x16Nimiq Signed Message:\n';

    private static get DEFAULT_ENDPOINT() {
        const originArray = location.origin.split('.');
        originArray.shift();
        const tld = originArray.join('.');

        switch (tld) {
            case 'nimiq.com':
                return 'https://hub.nimiq.com';
            case 'nimiq-testnet.com':
                return 'https://hub.nimiq-testnet.com';
            default:
                return 'http://localhost:8080';
        }
    }

    private readonly _endpoint: string;
    private readonly _defaultBehavior: RequestBehavior<DB>;
    private readonly _iframeBehavior: IFrameRequestBehavior;
    private readonly _redirectClient: RedirectRpcClient;

    constructor(endpoint: string = HubApi.DEFAULT_ENDPOINT, defaultBehavior?: RequestBehavior<DB>) {
        this._endpoint = endpoint;
        this._defaultBehavior = defaultBehavior || new PopupRequestBehavior(
            `left=${window.innerWidth / 2 - 400},top=75,width=800,height=850,location=yes,dependent=yes`) as any;
        this._iframeBehavior = new IFrameRequestBehavior();

        // Check for RPC results in the URL
        this._redirectClient = new RedirectRpcClient('', RequestBehavior.getAllowedOrigin(this._endpoint));
    }

    public checkRedirectResponse() {
        return this._redirectClient.init();
    }

    public on<T extends RequestType>(
        command: T,
        resolve: (result: ResultByRequestType<T>, state: any) => void,
        reject?: (error: Error, state: any) => void,
    ) {
        this._redirectClient.onResponse(command,
            // State is always an object containing at least the __command property
            (result: ResultByRequestType<T>, rpcId, state) => resolve(result, state),
            (error: Error, rpcId, state) => {
                if (!reject) return;
                reject(error, state);
            },
        );
    }

    public onboard<B extends BehaviorType = DB>(
        request: BasicRequest,
        requestBehavior: RequestBehavior<B> = this._defaultBehavior as any,
    ): Promise<B extends BehaviorType.REDIRECT ? void : Account[]> {
        return this._request(requestBehavior, RequestType.ONBOARD, [request]);
    }

    public signup<B extends BehaviorType = DB>(
        request: BasicRequest,
        requestBehavior: RequestBehavior<B> = this._defaultBehavior as any,
    ): Promise<B extends BehaviorType.REDIRECT ? void : Account[]> {
        return this._request(requestBehavior, RequestType.SIGNUP, [request]);
    }

    public login<B extends BehaviorType = DB>(
        request: BasicRequest,
        requestBehavior: RequestBehavior<B> = this._defaultBehavior as any,
    ): Promise<B extends BehaviorType.REDIRECT ? void : Account[]> {
        return this._request(requestBehavior, RequestType.LOGIN, [request]);
    }

    public chooseAddress<B extends BehaviorType = DB>(
        request: BasicRequest,
        requestBehavior: RequestBehavior<B> = this._defaultBehavior as any,
    ): Promise<B extends BehaviorType.REDIRECT ? void : Address> {
        return this._request(requestBehavior, RequestType.CHOOSE_ADDRESS, [request]);
    }

    public signTransaction<B extends BehaviorType = DB>(
        request: SignTransactionRequest,
        requestBehavior: RequestBehavior<B> = this._defaultBehavior as any,
    ): Promise<B extends BehaviorType.REDIRECT ? void : SignedTransaction> {
        return this._request(requestBehavior, RequestType.SIGN_TRANSACTION, [request]);
    }

    public checkout<B extends BehaviorType = DB>(
        request: CheckoutRequest,
        requestBehavior: RequestBehavior<B> = this._defaultBehavior as any,
    ): Promise<B extends BehaviorType.REDIRECT ? void : SignedTransaction> {
        return this._request(requestBehavior, RequestType.CHECKOUT, [request]);
    }

    public logout<B extends BehaviorType = DB>(
        request: SimpleRequest,
        requestBehavior: RequestBehavior<B> = this._defaultBehavior as any,
    ): Promise<B extends BehaviorType.REDIRECT ? void : SimpleResult> {
        return this._request(requestBehavior, RequestType.LOGOUT, [request]);
    }

    public export<B extends BehaviorType = DB>(
        request: ExportRequest,
        requestBehavior: RequestBehavior<B> = this._defaultBehavior as any,
    ): Promise<B extends BehaviorType.REDIRECT ? void : ExportResult> {
        return this._request(requestBehavior, RequestType.EXPORT, [request]);
    }

    public changePassword<B extends BehaviorType = DB>(
        request: SimpleRequest,
        requestBehavior: RequestBehavior<B> = this._defaultBehavior as any,
    ): Promise<B extends BehaviorType.REDIRECT ? void : SimpleResult> {
        return this._request(requestBehavior, RequestType.CHANGE_PASSWORD, [request]);
    }

    public addAddress<B extends BehaviorType = DB>(
        request: SimpleRequest,
        requestBehavior: RequestBehavior<B> = this._defaultBehavior as any,
    ): Promise<B extends BehaviorType.REDIRECT ? void : Address> {
        return this._request(requestBehavior, RequestType.ADD_ADDRESS, [request]);
    }

    public rename<B extends BehaviorType = DB>(
        request: RenameRequest,
        requestBehavior: RequestBehavior<B> = this._defaultBehavior as any,
    ): Promise<B extends BehaviorType.REDIRECT ? void : Account> {
        return this._request(requestBehavior, RequestType.RENAME, [request]);
    }

    public signMessage<B extends BehaviorType = DB>(
        request: SignMessageRequest,
        requestBehavior: RequestBehavior<B> = this._defaultBehavior as any,
    ): Promise<B extends BehaviorType.REDIRECT ? void : SignedMessage> {
        return this._request(requestBehavior, RequestType.SIGN_MESSAGE, [request]);
    }

    public migrate<B extends BehaviorType = DB>(
        requestBehavior: RequestBehavior<B> = this._defaultBehavior as any,
    ): Promise<B extends BehaviorType.REDIRECT ? void : Account[]> {
        return this._request(requestBehavior, RequestType.MIGRATE, [{ appName: 'Accounts Client' }]);
    }

    /**
     * Only accessible in iframe from Nimiq domains.
     */
    public list<B extends BehaviorType = DB>(
        requestBehavior: RequestBehavior<B> = this._iframeBehavior as any,
    ): Promise<B extends BehaviorType.REDIRECT ? void : Account[]> {
        return this._request(requestBehavior, RequestType.LIST, []);
    }

    // END API

    /* PRIVATE METHODS */

    private _request<R extends RequestType, BT extends BehaviorType>(
        behavior: RequestBehavior<BT>,
        command: R,
        args: any[],
    ) {
        return behavior.request<R>(this._endpoint, command, args);
    }
}