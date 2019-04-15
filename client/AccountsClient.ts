import {
    PopupRequestBehavior,
    IFrameRequestBehavior,
    RequestBehavior,
    RedirectRequestBehavior,
} from './RequestBehavior';
import { RedirectRpcClient } from '@nimiq/rpc';
import { RequestType } from '../src/lib/RequestTypes';
import {
    BasicRequest,
    SimpleRequest,
    Account,
    CheckoutRequest,
    SignTransactionRequest,
    SignedTransaction,
    Address,
    RenameRequest,
    SignMessageRequest,
    SignedMessage,
    SimpleResult,
    ExportRequest,
    ExportResult,
    ListResult,
    RpcResult,
} from '../src/lib/PublicRequestTypes';

export default class AccountsClient {
    public static readonly RequestType: typeof RequestType = RequestType;
    public static readonly RedirectRequestBehavior: typeof RedirectRequestBehavior = RedirectRequestBehavior;
    public static readonly MSG_PREFIX: string = '\x16Nimiq Signed Message:\n';

    private static get DEFAULT_ENDPOINT() {
        const originArray = location.origin.split('.');
        originArray.shift();
        const tld = originArray.join('.');

        switch (tld) {
            case 'nimiq.com':
                return 'https://accounts.nimiq.com';
            case 'nimiq-testnet.com':
                return 'https://accounts.nimiq-testnet.com';
            default:
                return 'http://localhost:8080';
        }
    }

    private readonly _endpoint: string;
    private readonly _defaultBehavior: RequestBehavior;
    private readonly _iframeBehavior: IFrameRequestBehavior;
    private readonly _redirectClient: RedirectRpcClient;

    constructor(endpoint: string = AccountsClient.DEFAULT_ENDPOINT, defaultBehavior?: RequestBehavior) {
        this._endpoint = endpoint;
        this._defaultBehavior = defaultBehavior || new PopupRequestBehavior(
            `left=${window.innerWidth / 2 - 400},top=75,width=800,height=850,location=yes,dependent=yes`);
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
            (result: RpcResult, rpcId, state) => resolve(result, state),
            (error: Error, rpcId, state) => reject && reject(error, state),
        );
    }

    public onboard(request: BasicRequest, requestBehavior = this._defaultBehavior): Promise<Account> {
        return this._request(requestBehavior, RequestType.ONBOARD, [request]);
    }

    public signup(request: BasicRequest, requestBehavior = this._defaultBehavior): Promise<Account> {
        return this._request(requestBehavior, RequestType.SIGNUP, [request]);
    }

    public login(request: BasicRequest, requestBehavior = this._defaultBehavior): Promise<Account> {
        return this._request(requestBehavior, RequestType.LOGIN, [request]);
    }

    public chooseAddress(request: BasicRequest, requestBehavior = this._defaultBehavior)
        : Promise<Address> {
        return this._request(requestBehavior, RequestType.CHOOSE_ADDRESS, [request]);
    }

    public signTransaction(
        request: SignTransactionRequest,
        requestBehavior = this._defaultBehavior,
    ): Promise<SignedTransaction> {
        return this._request(requestBehavior, RequestType.SIGN_TRANSACTION, [request]);
    }

    public checkout(request: CheckoutRequest, requestBehavior = this._defaultBehavior): Promise<SignedTransaction> {
        return this._request(requestBehavior, RequestType.CHECKOUT, [request]);
    }

    public logout(request: SimpleRequest, requestBehavior = this._defaultBehavior): Promise<SimpleResult> {
        return this._request(requestBehavior, RequestType.LOGOUT, [request]);
    }

    public export(
        request: ExportRequest,
        requestBehavior = this._defaultBehavior,
    ): Promise<ExportResult> {
        return this._request(requestBehavior, RequestType.EXPORT, [request]);
    }

    public changePassword(
        request: SimpleRequest,
        requestBehavior = this._defaultBehavior,
    ): Promise<SimpleResult> {
        return this._request(requestBehavior, RequestType.CHANGE_PASSWORD, [request]);
    }

    public addAddress(request: SimpleRequest, requestBehavior = this._defaultBehavior): Promise<Address> {
        return this._request(requestBehavior, RequestType.ADD_ADDRESS, [request]);
    }

    public rename(request: RenameRequest, requestBehavior = this._defaultBehavior): Promise<Account> {
        return this._request(requestBehavior, RequestType.RENAME, [request]);
    }

    public signMessage(
        request: SignMessageRequest,
        requestBehavior = this._defaultBehavior,
    ): Promise<SignedMessage> {
        return this._request(requestBehavior, RequestType.SIGN_MESSAGE, [request]);
    }

    public migrate(requestBehavior = this._defaultBehavior): Promise<ListResult> {
        return this._request(requestBehavior, RequestType.MIGRATE, [{ appName: 'Accounts Client' }]);
    }

    /**
     * Only accessible in iframe from Nimiq domains.
     */
    public list(requestBehavior = this._iframeBehavior): Promise<ListResult> {
        return this._request(requestBehavior, RequestType.LIST, []);
    }

    // END API

    /* PRIVATE METHODS */

    private _request(behavior: RequestBehavior, command: RequestType, args: any[]) {
        return behavior.request(this._endpoint, command, args);
    }
}
