import { PopupRequestBehavior, RequestBehavior, RedirectRequestBehavior, BehaviorType } from './RequestBehavior';
import { AccountType, RequestType, BasicRequest, SimpleRequest, OnboardRequest, ChooseAddressRequest, ChooseAddressResult, CheckoutRequest, SignTransactionRequest, RenameRequest, SignMessageRequest, ExportRequest, ResultByRequestType, Account, Address, SignedTransaction, SimpleResult, ExportResult, SignedMessage, CreateCashlinkRequest, ManageCashlinkRequest, SignBtcTransactionRequest, SignedBtcTransaction, AddBtcAddressesRequest, AddBtcAddressesResult, SignPolygonTransactionRequest, SignedPolygonTransaction, Cashlink, CashlinkState, CashlinkTheme, Currency, PaymentType, PaymentState, SetupSwapRequest, SetupSwapResult, RefundSwapRequest, SignMultisigTransactionRequest, PartialSignature, SignStakingRequest, ConnectAccountRequest, ConnectedAccount } from './PublicRequestTypes';
export default class HubApi<DB extends BehaviorType = BehaviorType.POPUP, IB extends BehaviorType = BehaviorType.IFRAME> {
    static readonly BehaviorType: typeof BehaviorType;
    static readonly RequestType: typeof RequestType;
    static readonly RedirectRequestBehavior: typeof RedirectRequestBehavior;
    static readonly PopupRequestBehavior: typeof PopupRequestBehavior;
    static readonly AccountType: typeof AccountType;
    static readonly CashlinkState: typeof CashlinkState;
    static readonly CashlinkTheme: typeof CashlinkTheme;
    static readonly Currency: typeof Currency;
    static readonly PaymentType: typeof PaymentType;
    static readonly PaymentState: typeof PaymentState;
    static readonly MSG_PREFIX = "\u0016Nimiq Signed Message:\n";
    /** @deprecated */
    static get PaymentMethod(): typeof PaymentType;
    private static get DEFAULT_ENDPOINT();
    private readonly _endpoint;
    private readonly _defaultBehavior;
    private readonly _checkoutDefaultBehavior;
    private readonly _iframeBehavior;
    private readonly _redirectClient;
    constructor(endpoint?: string, defaultBehavior?: RequestBehavior<DB>);
    checkRedirectResponse(): Promise<void>;
    on<T extends RequestType>(command: T, resolve: (result: ResultByRequestType<T>, state: any) => void, reject?: (error: Error, state: any) => void): void;
    /**
     * Public API
     */
    createCashlink<B extends BehaviorType = DB>(request: Promise<CreateCashlinkRequest> | CreateCashlinkRequest, requestBehavior?: RequestBehavior<B>): Promise<B extends BehaviorType.REDIRECT ? void : Cashlink>;
    manageCashlink<B extends BehaviorType = DB>(request: Promise<ManageCashlinkRequest> | ManageCashlinkRequest, requestBehavior?: RequestBehavior<B>): Promise<B extends BehaviorType.REDIRECT ? void : Cashlink>;
    checkout<R extends CheckoutRequest, B extends BehaviorType = DB>(request: Promise<R> | R, requestBehavior?: RequestBehavior<B>): Promise<B extends BehaviorType.REDIRECT ? void : R extends {
        version: 2;
    } ? SimpleResult | SignedTransaction : SignedTransaction>;
    chooseAddress<B extends BehaviorType = DB>(request: Promise<ChooseAddressRequest> | ChooseAddressRequest, requestBehavior?: RequestBehavior<B>): Promise<B extends BehaviorType.REDIRECT ? void : ChooseAddressResult>;
    signTransaction<B extends BehaviorType = DB>(request: Promise<SignTransactionRequest> | SignTransactionRequest, requestBehavior?: RequestBehavior<B>): Promise<B extends BehaviorType.REDIRECT ? void : SignedTransaction>;
    signStaking<B extends BehaviorType = DB>(request: Promise<SignStakingRequest> | SignStakingRequest, requestBehavior?: RequestBehavior<B>): Promise<B extends BehaviorType.REDIRECT ? void : SignedTransaction[]>;
    signMessage<B extends BehaviorType = DB>(request: Promise<SignMessageRequest> | SignMessageRequest, requestBehavior?: RequestBehavior<B>): Promise<B extends BehaviorType.REDIRECT ? void : SignedMessage>;
    signBtcTransaction<B extends BehaviorType = DB>(request: Promise<SignBtcTransactionRequest> | SignBtcTransactionRequest, requestBehavior?: RequestBehavior<B>): Promise<B extends BehaviorType.REDIRECT ? void : SignedBtcTransaction>;
    signPolygonTransaction<B extends BehaviorType = DB>(request: Promise<SignPolygonTransactionRequest> | SignPolygonTransactionRequest, requestBehavior?: RequestBehavior<B>): Promise<B extends BehaviorType.REDIRECT ? void : SignedPolygonTransaction>;
    setupSwap<B extends BehaviorType = DB>(request: Promise<SetupSwapRequest> | SetupSwapRequest, requestBehavior?: RequestBehavior<B>): Promise<B extends BehaviorType.REDIRECT ? void : SetupSwapResult>;
    refundSwap<B extends BehaviorType = DB>(request: Promise<RefundSwapRequest> | RefundSwapRequest, requestBehavior?: RequestBehavior<B>): Promise<B extends BehaviorType.REDIRECT ? void : SignedTransaction | SignedBtcTransaction | SignedPolygonTransaction>;
    signMultisigTransaction<B extends BehaviorType = DB>(request: Promise<SignMultisigTransactionRequest> | SignMultisigTransactionRequest, requestBehavior?: RequestBehavior<B>): Promise<B extends BehaviorType.REDIRECT ? void : PartialSignature>;
    connectAccount<B extends BehaviorType = DB>(request: Promise<ConnectAccountRequest> | ConnectAccountRequest, requestBehavior?: RequestBehavior<B>): Promise<B extends BehaviorType.REDIRECT ? void : ConnectedAccount>;
    /**
     * Account Management
     *
     * Only accessible from Nimiq domains.
     */
    onboard<B extends BehaviorType = DB>(request: Promise<OnboardRequest> | OnboardRequest, requestBehavior?: RequestBehavior<B>): Promise<B extends BehaviorType.REDIRECT ? void : Account[]>;
    signup<B extends BehaviorType = DB>(request: Promise<BasicRequest> | BasicRequest, requestBehavior?: RequestBehavior<B>): Promise<B extends BehaviorType.REDIRECT ? void : Account[]>;
    login<B extends BehaviorType = DB>(request: Promise<BasicRequest> | BasicRequest, requestBehavior?: RequestBehavior<B>): Promise<B extends BehaviorType.REDIRECT ? void : Account[]>;
    logout<B extends BehaviorType = DB>(request: Promise<SimpleRequest> | SimpleRequest, requestBehavior?: RequestBehavior<B>): Promise<B extends BehaviorType.REDIRECT ? void : SimpleResult>;
    export<B extends BehaviorType = DB>(request: Promise<ExportRequest> | ExportRequest, requestBehavior?: RequestBehavior<B>): Promise<B extends BehaviorType.REDIRECT ? void : ExportResult>;
    changePassword<B extends BehaviorType = DB>(request: Promise<SimpleRequest> | SimpleRequest, requestBehavior?: RequestBehavior<B>): Promise<B extends BehaviorType.REDIRECT ? void : SimpleResult>;
    addAddress<B extends BehaviorType = DB>(request: Promise<SimpleRequest> | SimpleRequest, requestBehavior?: RequestBehavior<B>): Promise<B extends BehaviorType.REDIRECT ? void : Address>;
    rename<B extends BehaviorType = DB>(request: Promise<RenameRequest> | RenameRequest, requestBehavior?: RequestBehavior<B>): Promise<B extends BehaviorType.REDIRECT ? void : Account>;
    addVestingContract<B extends BehaviorType = DB>(request: Promise<BasicRequest> | BasicRequest, requestBehavior?: RequestBehavior<B>): Promise<B extends BehaviorType.REDIRECT ? void : Account>;
    migrate<B extends BehaviorType = DB>(requestBehavior?: RequestBehavior<B>): Promise<B extends BehaviorType.REDIRECT ? void : Account[]>;
    activateBitcoin<B extends BehaviorType = DB>(request: Promise<SimpleRequest> | SimpleRequest, requestBehavior?: RequestBehavior<B>): Promise<B extends BehaviorType.REDIRECT ? void : Account>;
    activatePolygon<B extends BehaviorType = DB>(request: Promise<SimpleRequest> | SimpleRequest, requestBehavior?: RequestBehavior<B>): Promise<B extends BehaviorType.REDIRECT ? void : Account>;
    /**
     * Only accessible in iframe from Nimiq domains.
     */
    list<B extends BehaviorType = IB>(requestBehavior?: RequestBehavior<B>): Promise<B extends BehaviorType.REDIRECT ? void : Account[]>;
    cashlinks<B extends BehaviorType = IB>(requestBehavior?: RequestBehavior<B>): Promise<B extends BehaviorType.REDIRECT ? void : Cashlink[]>;
    addBtcAddresses<B extends BehaviorType = IB>(request: AddBtcAddressesRequest, requestBehavior?: RequestBehavior<B>): Promise<B extends BehaviorType.REDIRECT ? void : AddBtcAddressesResult>;
    private _request;
}
