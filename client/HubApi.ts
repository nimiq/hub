import {
    PopupRequestBehavior,
    IFrameRequestBehavior,
    RequestBehavior,
    RedirectRequestBehavior,
    BehaviorType,
} from './RequestBehavior';
import { RedirectRpcClient } from '@nimiq/rpc';
import {
    AccountType,
    RequestType,
    BasicRequest,
    SimpleRequest,
    OnboardRequest,
    ChooseAddressRequest,
    ChooseAddressResult,
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
    CreateCashlinkRequest,
    ManageCashlinkRequest,
    SignBtcTransactionRequest,
    SignedBtcTransaction,
    AddBtcAddressesRequest,
    AddBtcAddressesResult,
    SignPolygonTransactionRequest,
    SignedPolygonTransaction,
    Cashlink,
    CashlinkState,
    CashlinkTheme,
    Currency,
    PaymentType,
    PaymentState,
    SetupSwapRequest,
    SetupSwapResult,
    RefundSwapRequest,
} from './PublicRequestTypes';

export default class HubApi<
    DB extends BehaviorType = BehaviorType.POPUP,
    IB extends BehaviorType = BehaviorType.IFRAME
> { // DB: Default Behavior, IB: Iframe Behavior
    // Expose request behaviors and enum values. Not exporting them via regular exports to avoid that users of the umd
    // build have to use bundle['default'] to access the default export.
    // Additionally, the types of these are exported in the client's index.d.ts.
    public static readonly BehaviorType = BehaviorType;
    public static readonly RequestType = RequestType;
    public static readonly RedirectRequestBehavior = RedirectRequestBehavior;
    public static readonly PopupRequestBehavior = PopupRequestBehavior;
    public static readonly AccountType = AccountType;
    public static readonly CashlinkState = CashlinkState;
    public static readonly CashlinkTheme = CashlinkTheme;
    public static readonly Currency = Currency;
    public static readonly PaymentType = PaymentType;
    public static readonly PaymentState = PaymentState;
    public static readonly MSG_PREFIX = '\x16Nimiq Signed Message:\n';

    /** @deprecated */
    public static get PaymentMethod() {
        console.warn('PaymentMethod has been renamed to PaymentType. Access via HubApi.PaymentMethod will soon '
            + 'get disabled. Use HubApi.PaymentType instead.');
        return PaymentType;
    }

    private static get DEFAULT_ENDPOINT() {
        const mainDomainMatch = location.hostname.match(/(?:[^.]+\.[^.]+|localhost)$/);
        const mainDomain = mainDomainMatch ? mainDomainMatch[0] : location.hostname;

        switch (mainDomain) {
            case 'nimiq.com':
            case 'nimiq-testnet.com':
                return `https://hub.${mainDomain}`;
            case 'bs-local.com':
                // BrowserStack's localhost tunnel bs-local.com for iOS debugging in BrowserStack, see
                // https://www.browserstack.com/docs/live/local-testing/ios-troubleshooting-guide
                return `${window.location.protocol}//bs-local.com:8080`;
            default:
                return 'http://localhost:8080';
        }
    }

    private readonly _endpoint: string;
    private readonly _defaultBehavior: RequestBehavior<DB>;
    private readonly _checkoutDefaultBehavior: RequestBehavior<DB>;
    private readonly _iframeBehavior: IFrameRequestBehavior;
    private readonly _redirectClient: RedirectRpcClient;

    constructor(endpoint: string = HubApi.DEFAULT_ENDPOINT, defaultBehavior?: RequestBehavior<DB>) {
        this._endpoint = endpoint;
        this._defaultBehavior = defaultBehavior || new PopupRequestBehavior(
            `left=${window.innerWidth / 2 - 400},top=75,width=800,height=850,location=yes,dependent=yes`) as any;
        // If no default behavior specified, use a default behavior with increased window height for checkout.
        this._checkoutDefaultBehavior = defaultBehavior || new PopupRequestBehavior(
            `left=${window.innerWidth / 2 - 400},top=50,width=800,height=895,location=yes,dependent=yes`) as any;
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

    /**
     * Public API
     */

    public createCashlink<B extends BehaviorType = DB>(
        request: Promise<CreateCashlinkRequest> | CreateCashlinkRequest,
        requestBehavior: RequestBehavior<B> = this._defaultBehavior as any,
    ): Promise<B extends BehaviorType.REDIRECT ? void : Cashlink> {
        return this._request(requestBehavior, RequestType.CREATE_CASHLINK, [request]);
    }

    public manageCashlink<B extends BehaviorType = DB>(
        request: Promise<ManageCashlinkRequest> | ManageCashlinkRequest,
        requestBehavior: RequestBehavior<B> = this._defaultBehavior as any,
    ): Promise<B extends BehaviorType.REDIRECT ? void : Cashlink> {
        return this._request(requestBehavior, RequestType.MANAGE_CASHLINK, [request]);
    }

    public checkout<R extends CheckoutRequest, B extends BehaviorType = DB>(
        request: Promise<R> | R,
        requestBehavior: RequestBehavior<B> = this._checkoutDefaultBehavior as any,
    ): Promise<B extends BehaviorType.REDIRECT
        ? void
        : R extends { version: 2 }
            ? SimpleResult | SignedTransaction
            : SignedTransaction
    > {
        return this._request(requestBehavior, RequestType.CHECKOUT, [request]) as any;
    }

    public chooseAddress<B extends BehaviorType = DB>(
        request: Promise<ChooseAddressRequest> | ChooseAddressRequest,
        requestBehavior: RequestBehavior<B> = this._defaultBehavior as any,
    ): Promise<B extends BehaviorType.REDIRECT ? void : ChooseAddressResult> {
        return this._request(requestBehavior, RequestType.CHOOSE_ADDRESS, [request]);
    }

    public signTransaction<B extends BehaviorType = DB>(
        request: Promise<SignTransactionRequest> | SignTransactionRequest,
        requestBehavior: RequestBehavior<B> = this._defaultBehavior as any,
    ): Promise<B extends BehaviorType.REDIRECT ? void : SignedTransaction> {
        return this._request(requestBehavior, RequestType.SIGN_TRANSACTION, [request]);
    }

    public signMessage<B extends BehaviorType = DB>(
        request: Promise<SignMessageRequest> | SignMessageRequest,
        requestBehavior: RequestBehavior<B> = this._defaultBehavior as any,
    ): Promise<B extends BehaviorType.REDIRECT ? void : SignedMessage> {
        return this._request(requestBehavior, RequestType.SIGN_MESSAGE, [request]);
    }

    public signBtcTransaction<B extends BehaviorType = DB>(
        request: Promise<SignBtcTransactionRequest> | SignBtcTransactionRequest,
        requestBehavior: RequestBehavior<B> = this._defaultBehavior as any,
    ): Promise<B extends BehaviorType.REDIRECT ? void : SignedBtcTransaction> {
        return this._request(requestBehavior, RequestType.SIGN_BTC_TRANSACTION, [request]);
    }

    public signPolygonTransaction<B extends BehaviorType = DB>(
        request: Promise<SignPolygonTransactionRequest> | SignPolygonTransactionRequest,
        requestBehavior: RequestBehavior<B> = this._defaultBehavior as any,
    ): Promise<B extends BehaviorType.REDIRECT ? void : SignedPolygonTransaction> {
        return this._request(requestBehavior, RequestType.SIGN_POLYGON_TRANSACTION, [request]);
    }

    public setupSwap<B extends BehaviorType = DB>(
        request: Promise<SetupSwapRequest> | SetupSwapRequest,
        requestBehavior: RequestBehavior<B> = this._defaultBehavior as any,
    ): Promise<B extends BehaviorType.REDIRECT ? void : SetupSwapResult> {
        return this._request(requestBehavior, RequestType.SETUP_SWAP, [request]);
    }

    public refundSwap<B extends BehaviorType = DB>(
        request: Promise<RefundSwapRequest> | RefundSwapRequest,
        requestBehavior: RequestBehavior<B> = this._defaultBehavior as any,
    ): Promise<B extends BehaviorType.REDIRECT
        ? void
        : SignedTransaction | SignedBtcTransaction | SignedPolygonTransaction> {
        return this._request(requestBehavior, RequestType.REFUND_SWAP, [request]);
    }

    /**
     * Account Management
     *
     * Only accessible from Nimiq domains.
     */

    public onboard<B extends BehaviorType = DB>(
        request: Promise<OnboardRequest> | OnboardRequest,
        requestBehavior: RequestBehavior<B> = this._defaultBehavior as any,
    ): Promise<B extends BehaviorType.REDIRECT ? void : Account[]> {
        return this._request(requestBehavior, RequestType.ONBOARD, [request]);
    }

    public signup<B extends BehaviorType = DB>(
        request: Promise<BasicRequest> | BasicRequest,
        requestBehavior: RequestBehavior<B> = this._defaultBehavior as any,
    ): Promise<B extends BehaviorType.REDIRECT ? void : Account[]> {
        return this._request(requestBehavior, RequestType.SIGNUP, [request]);
    }

    public login<B extends BehaviorType = DB>(
        request: Promise<BasicRequest> | BasicRequest,
        requestBehavior: RequestBehavior<B> = this._defaultBehavior as any,
    ): Promise<B extends BehaviorType.REDIRECT ? void : Account[]> {
        return this._request(requestBehavior, RequestType.LOGIN, [request]);
    }

    public logout<B extends BehaviorType = DB>(
        request: Promise<SimpleRequest> | SimpleRequest,
        requestBehavior: RequestBehavior<B> = this._defaultBehavior as any,
    ): Promise<B extends BehaviorType.REDIRECT ? void : SimpleResult> {
        return this._request(requestBehavior, RequestType.LOGOUT, [request]);
    }

    public export<B extends BehaviorType = DB>(
        request: Promise<ExportRequest> | ExportRequest,
        requestBehavior: RequestBehavior<B> = this._defaultBehavior as any,
    ): Promise<B extends BehaviorType.REDIRECT ? void : ExportResult> {
        return this._request(requestBehavior, RequestType.EXPORT, [request]);
    }

    public changePassword<B extends BehaviorType = DB>(
        request: Promise<SimpleRequest> | SimpleRequest,
        requestBehavior: RequestBehavior<B> = this._defaultBehavior as any,
    ): Promise<B extends BehaviorType.REDIRECT ? void : SimpleResult> {
        return this._request(requestBehavior, RequestType.CHANGE_PASSWORD, [request]);
    }

    public addAddress<B extends BehaviorType = DB>(
        request: Promise<SimpleRequest> | SimpleRequest,
        requestBehavior: RequestBehavior<B> = this._defaultBehavior as any,
    ): Promise<B extends BehaviorType.REDIRECT ? void : Address> {
        return this._request(requestBehavior, RequestType.ADD_ADDRESS, [request]);
    }

    public rename<B extends BehaviorType = DB>(
        request: Promise<RenameRequest> | RenameRequest,
        requestBehavior: RequestBehavior<B> = this._defaultBehavior as any,
    ): Promise<B extends BehaviorType.REDIRECT ? void : Account> {
        return this._request(requestBehavior, RequestType.RENAME, [request]);
    }

    public addVestingContract<B extends BehaviorType = DB>(
        request: Promise<BasicRequest> | BasicRequest,
        requestBehavior: RequestBehavior<B> = this._defaultBehavior as any,
    ): Promise<B extends BehaviorType.REDIRECT ? void : Account> {
        return this._request(requestBehavior, RequestType.ADD_VESTING_CONTRACT, [request]);
    }

    public migrate<B extends BehaviorType = DB>(
        requestBehavior: RequestBehavior<B> = this._defaultBehavior as any,
    ): Promise<B extends BehaviorType.REDIRECT ? void : Account[]> {
        return this._request(requestBehavior, RequestType.MIGRATE, [{ appName: 'Account list' }]);
    }

    public activateBitcoin<B extends BehaviorType = DB>(
        request: Promise<SimpleRequest> | SimpleRequest,
        requestBehavior: RequestBehavior<B> = this._defaultBehavior as any,
    ): Promise<B extends BehaviorType.REDIRECT ? void : Account> {
        return this._request(requestBehavior, RequestType.ACTIVATE_BITCOIN, [request]);
    }

    public activatePolygon<B extends BehaviorType = DB>(
        request: Promise<SimpleRequest> | SimpleRequest,
        requestBehavior: RequestBehavior<B> = this._defaultBehavior as any,
    ): Promise<B extends BehaviorType.REDIRECT ? void : Account> {
        return this._request(requestBehavior, RequestType.ACTIVATE_POLYGON, [request]);
    }

    /**
     * Only accessible in iframe from Nimiq domains.
     */
    public list<B extends BehaviorType = IB>(
        requestBehavior: RequestBehavior<B> = this._iframeBehavior as any,
    ): Promise<B extends BehaviorType.REDIRECT ? void : Account[]> {
        return this._request(requestBehavior, RequestType.LIST, []);
    }

    public cashlinks<B extends BehaviorType = IB>(
        requestBehavior: RequestBehavior<B> = this._iframeBehavior as any,
    ): Promise<B extends BehaviorType.REDIRECT ? void : Cashlink[]> {
        return this._request(requestBehavior, RequestType.LIST_CASHLINKS, []);
    }

    public addBtcAddresses<B extends BehaviorType = IB>(
        request: AddBtcAddressesRequest,
        requestBehavior: RequestBehavior<B> = this._iframeBehavior as any,
    ): Promise<B extends BehaviorType.REDIRECT ? void : AddBtcAddressesResult> {
        return this._request(requestBehavior, RequestType.ADD_BTC_ADDRESSES, [request]);
    }

    // END API

    /* PRIVATE METHODS */

    private _request<R extends RequestType, BT extends BehaviorType>(
        behavior: RequestBehavior<BT>,
        command: R,
        args: Iterable<PromiseLike<any> | any>,
    ) {
        return behavior.request<R>(this._endpoint, command, args);
    }
}
