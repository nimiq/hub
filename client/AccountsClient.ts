import {
    PopupRequestBehavior,
    IFrameRequestBehavior,
    RequestBehavior,
    RedirectRequestBehavior,
} from './RequestBehavior';
import { RedirectRpcClient } from '@nimiq/rpc';
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
    ExportFileRequest,
    ExportFileResult,
    ExportWordsRequest,
    ExportWordsResult,
    AddAccountRequest,
    AddAccountResult,
    // ListResult,
    RpcResult,
} from '../src/lib/RequestTypes';

export default class AccountsClient {
    public static readonly RequestType: typeof RequestType = RequestType;
    public static readonly RedirectRequestBehavior: typeof RedirectRequestBehavior = RedirectRequestBehavior;

    private static readonly DEFAULT_ENDPOINT =
    window.location.origin === 'https://safe-next.nimiq.com' ? 'https://accounts.nimiq.com'
    : window.location.origin === 'https://safe-next.nimiq-testnet.com' ? 'https://accounts.nimiq-testnet.com'
    : 'http://localhost:8080';

    private readonly _endpoint: string;
    private readonly _defaultBehavior: RequestBehavior;
    private readonly _iframeBehavior: IFrameRequestBehavior;
    private readonly _redirectClient: RedirectRpcClient;

    constructor(endpoint: string = AccountsClient.DEFAULT_ENDPOINT, defaultBehavior?: RequestBehavior) {
        this._endpoint = endpoint;
        this._defaultBehavior = defaultBehavior || new PopupRequestBehavior(
            `left=${window.innerWidth / 2 - 500},top=50,width=1000,height=900,location=yes,dependent=yes`);
        this._iframeBehavior = new IFrameRequestBehavior();

        // Check for RPC results in the URL
        this._redirectClient = new RedirectRpcClient('', RequestBehavior.getAllowedOrigin(this._endpoint));
    }

    public checkRedirectResponse() {
        return this._redirectClient.init();
    }

    public on(
        command: RequestType,
        resolve: (result: RpcResult, state: any) => any,
        reject?: (error: Error, state: any) => any,
    ) {
        this._redirectClient.onResponse(command,
            // State is always an object containing at least the __command property
            (result: RpcResult, rpcId, state) => resolve(result, JSON.parse(state!)),
            (error: Error, rpcId, state) => reject && reject(error, JSON.parse(state!)),
        );
    }

    public signup(request: SignupRequest, requestBehavior = this._defaultBehavior): Promise<SignupResult> {
        return this._request(requestBehavior, RequestType.SIGNUP, [request]);
    }

    public signTransaction(
        request: SignTransactionRequest,
        requestBehavior = this._defaultBehavior,
    ): Promise<SignTransactionResult> {
        return this._request(requestBehavior, RequestType.SIGN_TRANSACTION, [request]);
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

    public exportFile(
        request: ExportFileRequest,
        requestBehavior = this._defaultBehavior,
    ): Promise<ExportFileResult> {
        return this._request(requestBehavior, RequestType.EXPORT_FILE, [request]);
    }

    public exportWords(
        request: ExportWordsRequest,
        requestBehavior = this._defaultBehavior,
    ): Promise<ExportWordsResult> {
        return this._request(requestBehavior, RequestType.EXPORT_WORDS, [request]);
    }

    public addAccount(request: AddAccountRequest, requestBehavior = this._defaultBehavior): Promise<AddAccountResult> {
        return this._request(requestBehavior, RequestType.ADD_ACCOUNT, [request]);
    }

    /**
     * Only accessible in iframe from Nimiq domains.
     */
    public list(requestBehavior = this._iframeBehavior) /*: Promise<ListResult> */ {
        return this._request(requestBehavior, RequestType.LIST, []);
    }

    // END API

    /* PRIVATE METHODS */

    private _request(behavior: RequestBehavior, command: RequestType, args: any[]) {
        return behavior.request(this._endpoint, command, args);
    }
}
