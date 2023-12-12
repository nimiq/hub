import type { RelayRequest } from '@opengsn/common/dist/EIP712/RelayRequest';
import { NimiqSpecifics, NimiqDirectPaymentOptions, BitcoinSpecifics, BitcoinDirectPaymentOptions, EtherSpecifics, EtherDirectPaymentOptions } from './PublicPaymentOptions';
export declare enum RequestType {
    LIST = "list",
    LIST_CASHLINKS = "list-cashlinks",
    MIGRATE = "migrate",
    CHECKOUT = "checkout",
    SIGN_MESSAGE = "sign-message",
    SIGN_TRANSACTION = "sign-transaction",
    SIGN_STAKING = "sign-staking",
    ONBOARD = "onboard",
    SIGNUP = "signup",
    LOGIN = "login",
    EXPORT = "export",
    CHANGE_PASSWORD = "change-password",
    LOGOUT = "logout",
    ADD_ADDRESS = "add-address",
    RENAME = "rename",
    ADD_VESTING_CONTRACT = "add-vesting-contract",
    CHOOSE_ADDRESS = "choose-address",
    CREATE_CASHLINK = "create-cashlink",
    MANAGE_CASHLINK = "manage-cashlink",
    SIGN_BTC_TRANSACTION = "sign-btc-transaction",
    ADD_BTC_ADDRESSES = "add-btc-addresses",
    SIGN_POLYGON_TRANSACTION = "sign-polygon-transaction",
    ACTIVATE_BITCOIN = "activate-bitcoin",
    ACTIVATE_POLYGON = "activate-polygon",
    SETUP_SWAP = "setup-swap",
    REFUND_SWAP = "refund-swap"
}
export declare type Bytes = Uint8Array | string;
export declare enum AccountType {
    LEGACY = 1,
    BIP39 = 2,
    LEDGER = 3
}
export { 
/** @deprecated Use AccountType instead */
AccountType as WalletType, };
export interface BasicRequest {
    appName: string;
}
export interface SimpleRequest extends BasicRequest {
    accountId: string;
}
export interface SimpleResult {
    success: true;
}
export interface OnboardRequest extends BasicRequest {
    disableBack?: boolean;
}
export interface ChooseAddressRequest extends BasicRequest {
    returnBtcAddress?: boolean;
    minBalance?: number;
    disableContracts?: boolean;
    disableLegacyAccounts?: boolean;
    disableBip39Accounts?: boolean;
    disableLedgerAccounts?: boolean;
}
export interface ChooseAddressResult extends Address {
    btcAddress?: string;
}
export interface SignTransactionRequest extends BasicRequest {
    sender: string;
    recipient: string;
    recipientType?: Nimiq.Account.Type | 3;
    recipientLabel?: string;
    value: number;
    fee?: number;
    extraData?: Bytes;
    flags?: number;
    validityStartHeight: number;
}
export interface SignStakingRequest extends BasicRequest {
    senderLabel?: string;
    recipientLabel?: string;
    transaction: Uint8Array;
}
export interface NimiqCheckoutRequest extends BasicRequest {
    version?: 1;
    shopLogoUrl?: string;
    sender?: string;
    forceSender?: boolean;
    recipient: string;
    recipientType?: Nimiq.Account.Type;
    value: number;
    fee?: number;
    extraData?: Bytes;
    flags?: number;
    validityDuration?: number;
    disableDisclaimer?: boolean;
}
export declare enum PaymentType {
    DIRECT = 0,
    OASIS = 1
}
export declare enum Currency {
    NIM = "nim",
    BTC = "btc",
    ETH = "eth"
}
export declare type ProtocolSpecificsForCurrency<C extends Currency> = C extends Currency.NIM ? NimiqSpecifics : C extends Currency.BTC ? BitcoinSpecifics : C extends Currency.ETH ? EtherSpecifics : undefined;
export declare enum PaymentState {
    NOT_FOUND = "NOT_FOUND",
    PAID = "PAID",
    UNDERPAID = "UNDERPAID",
    OVERPAID = "OVERPAID"
}
export interface PaymentOptions<C extends Currency, T extends PaymentType> {
    type: T;
    currency: C;
    expires?: number;
    /**
     * Amount in the smallest unit of the currency specified as `currency`.
     * i.e Luna for Currency.NIM and Satoshi for Currency.BTC
     */
    amount: string;
    /**
     * Crypto payment markup contained in `amount` that the vendor charges. Relative value, e.g. .01 for 1%.
     * Can be negative to describe a discount.
     */
    vendorMarkup?: number;
    protocolSpecific: ProtocolSpecificsForCurrency<C>;
}
export declare type AvailablePaymentOptions = NimiqDirectPaymentOptions | EtherDirectPaymentOptions | BitcoinDirectPaymentOptions;
export declare type PaymentOptionsForCurrencyAndType<C extends Currency, T extends PaymentType> = T extends PaymentType.DIRECT ? C extends Currency.NIM ? NimiqDirectPaymentOptions : C extends Currency.BTC ? BitcoinDirectPaymentOptions : C extends Currency.ETH ? EtherDirectPaymentOptions : PaymentOptions<C, T> : PaymentOptions<C, T>;
export interface MultiCurrencyCheckoutRequest extends BasicRequest {
    version: 2;
    /**
     * Must be located on the same origin as the one the request is sent from.
     */
    shopLogoUrl: string;
    /**
     * TODO description of the api the callback needs to provide.
     * Input is {currency, type} alongside the order identifying parameters in the url.
     * the called url must return a PaymentOptions<currency, type> object
     */
    callbackUrl?: string;
    /**
     * A CSRF token, that will be transmitted in all requests to the callback url.
     */
    csrf?: string;
    /**
     * The data to be included in the transaction. Ignored for `Currenct.BTC` and `Currency.ETH`.
     * @deprecated use NimiqDirectPaymentOptions.protocolSpecific.extraData instead.
     */
    extraData?: Bytes;
    /**
     * Current time in seconds or milliseconds
     */
    time: number;
    /**
     * ISO 4217 Code (three letters) of the fiat currency used on the calling site.
     */
    fiatCurrency: string;
    /**
     * Amount in the currency specified by `fiatCurrency`
     */
    fiatAmount: number;
    /**
     * Array of available payment options.
     * Each currency can only be present once, and a Currency.NIM option must exist.
     */
    paymentOptions: AvailablePaymentOptions[];
    /**
     * Enable UI adaptions for the use as point of sale. Paying directly from logged-in hub accounts and buttons to open
     * local wallets get disabled.
     */
    isPointOfSale?: boolean;
    /**
     * Option to disable the disclaimer at the bottom of the checkout page. Only allowed for privileged origins.
     */
    disableDisclaimer?: boolean;
}
export declare type CheckoutRequest = NimiqCheckoutRequest | MultiCurrencyCheckoutRequest;
export interface SignedTransaction {
    transaction: Uint8Array;
    serializedTx: string;
    hash: string;
    raw: {
        signerPublicKey: Uint8Array;
        signature: Uint8Array;
        sender: string;
        senderType: Nimiq.Account.Type | 3;
        recipient: string;
        recipientType: Nimiq.Account.Type | 3;
        value: number;
        fee: number;
        validityStartHeight: number;
        extraData: Uint8Array;
        flags: number;
        networkId: number;
        proof: Uint8Array;
    };
}
export interface NimiqHtlcCreationInstructions {
    type: 'NIM';
    sender: string;
    value: number;
    fee: number;
    validityStartHeight: number;
}
export interface BitcoinHtlcCreationInstructions {
    type: 'BTC';
    inputs: Array<{
        address: string;
        transactionHash: string;
        outputIndex: number;
        outputScript: string;
        value: number;
        sequence?: number;
    }>;
    output: {
        value: number;
    };
    changeOutput?: {
        address: string;
        value: number;
    };
    refundAddress: string;
    locktime?: number;
}
export interface PolygonHtlcCreationInstructions extends RelayRequest {
    type: 'USDC';
    /**
     * The sender's nonce in the token contract, required when calling the
     * contract function `openWithApproval`.
     */
    approval?: {
        tokenNonce: number;
    };
}
export interface EuroHtlcCreationInstructions {
    type: 'EUR';
    value: number;
    fee: number;
    bankLabel?: string;
}
export interface NimiqHtlcSettlementInstructions {
    type: 'NIM';
    recipient: string;
    value: number;
    fee: number;
    extraData?: Bytes;
    validityStartHeight: number;
}
export interface BitcoinHtlcSettlementInstructions {
    type: 'BTC';
    input: {
        value: number;
    };
    output: {
        address: string;
        value: number;
    };
}
export interface PolygonHtlcSettlementInstructions extends RelayRequest {
    type: 'USDC';
    amount: number;
}
export interface EuroHtlcSettlementInstructions {
    type: 'EUR';
    value: number;
    fee: number;
    bankLabel?: string;
    settlement: {
        type: 'sepa';
        recipient: {
            name: string;
            iban: string;
            bic: string;
        };
    } | {
        type: 'mock';
    };
}
export interface NimiqHtlcRefundInstructions {
    type: 'NIM';
    sender: string;
    recipient: string;
    value: number;
    fee: number;
    extraData?: Bytes;
    validityStartHeight: number;
}
export interface BitcoinHtlcRefundInstructions {
    type: 'BTC';
    input: {
        transactionHash: string;
        outputIndex: number;
        outputScript: string;
        value: number;
        witnessScript: string;
    };
    output: {
        address: string;
        value: number;
    };
    refundAddress: string;
}
export interface PolygonHtlcRefundInstructions extends RelayRequest {
    type: 'USDC';
    amount: number;
}
export declare type HtlcCreationInstructions = NimiqHtlcCreationInstructions | BitcoinHtlcCreationInstructions | PolygonHtlcCreationInstructions | EuroHtlcCreationInstructions;
export declare type HtlcSettlementInstructions = NimiqHtlcSettlementInstructions | BitcoinHtlcSettlementInstructions | PolygonHtlcSettlementInstructions | EuroHtlcSettlementInstructions;
export declare type HtlcRefundInstructions = NimiqHtlcRefundInstructions | BitcoinHtlcRefundInstructions | PolygonHtlcRefundInstructions;
export interface SetupSwapRequest extends SimpleRequest {
    swapId: string;
    fund: HtlcCreationInstructions;
    redeem: HtlcSettlementInstructions;
    fiatCurrency: string;
    fundingFiatRate: number;
    redeemingFiatRate: number;
    fundFees: {
        processing: number;
        redeeming: number;
    };
    redeemFees: {
        funding: number;
        processing: number;
    };
    serviceSwapFee: number;
    layout?: 'standard' | 'slider';
    direction?: 'left-to-right' | 'right-to-left';
    nimiqAddresses?: Array<{
        address: string;
        balance: number;
    }>;
    bitcoinAccount?: {
        balance: number;
    };
    polygonAddresses?: Array<{
        address: string;
        balance: number;
    }>;
    kyc?: {
        provider: 'TEN31 Pass';
        userId: string;
        s3GrantToken: string;
        oasisGrantToken?: string;
    };
}
export interface SetupSwapResult {
    nim?: SignedTransaction;
    nimProxy?: SignedTransaction;
    btc?: SignedBtcTransaction;
    usdc?: SignedPolygonTransaction;
    eur?: string;
    refundTx?: string;
}
export interface RefundSwapRequest extends SimpleRequest {
    refund: HtlcRefundInstructions;
}
export interface SignMessageRequest extends BasicRequest {
    signer?: string;
    message: string | Uint8Array;
}
export interface SignedMessage {
    signer: string;
    signerPublicKey: Uint8Array;
    signature: Uint8Array;
}
export interface Address {
    address: string;
    label: string;
}
export interface VestingContract {
    type: Nimiq.Account.Type.VESTING;
    address: string;
    label: string;
    owner: string;
    start: number;
    stepAmount: number;
    stepBlocks: number;
    totalAmount: number;
}
export interface HashedTimeLockedContract {
    type: Nimiq.Account.Type.HTLC;
    address: string;
    label: string;
    sender: string;
    recipient: string;
    hashRoot: string;
    hashCount: number;
    timeout: number;
    totalAmount: number;
}
export declare type Contract = VestingContract | HashedTimeLockedContract;
export interface Account {
    accountId: string;
    label: string;
    type: AccountType;
    fileExported: boolean;
    wordsExported: boolean;
    addresses: Address[];
    contracts: Contract[];
    btcAddresses: {
        internal: string[];
        external: string[];
    };
    polygonAddresses: string[];
    uid: string;
    requestType: RequestType;
}
export interface ExportRequest extends SimpleRequest {
    fileOnly?: boolean;
    wordsOnly?: boolean;
}
export interface ExportResult {
    fileExported: boolean;
    wordsExported: boolean;
}
export interface RenameRequest extends SimpleRequest {
    address?: string;
}
export declare enum CashlinkState {
    UNKNOWN = -1,
    UNCHARGED = 0,
    CHARGING = 1,
    UNCLAIMED = 2,
    CLAIMING = 3,
    CLAIMED = 4
}
export declare enum CashlinkTheme {
    UNSPECIFIED = 0,
    STANDARD = 1,
    CHRISTMAS = 2,
    LUNAR_NEW_YEAR = 3,
    EASTER = 4,
    GENERIC = 5,
    BIRTHDAY = 6
}
export interface Cashlink {
    address: string;
    message: string;
    value: number;
    status: CashlinkState;
    theme: CashlinkTheme;
    link?: string;
}
export declare type CreateCashlinkRequest = BasicRequest & {
    value?: number;
    theme?: CashlinkTheme;
    fiatCurrency?: string;
} & ({} | {
    message: string;
    autoTruncateMessage?: boolean;
}) & ({} | {
    senderAddress: string;
    senderBalance?: number;
}) & ({
    returnLink?: false;
} | {
    returnLink: true;
    skipSharing?: boolean;
});
export interface ManageCashlinkRequest extends BasicRequest {
    cashlinkAddress: string;
}
/**
 * Bitcoin
 */
export interface SignBtcTransactionRequest extends SimpleRequest {
    inputs: Array<{
        address: string;
        transactionHash: string;
        outputIndex: number;
        outputScript: string;
        value: number;
        witnessScript?: string;
        sequence?: number;
    }>;
    output: {
        address: string;
        value: number;
        label?: string;
    };
    changeOutput?: {
        address: string;
        value: number;
    };
    locktime?: number;
}
export interface SignedBtcTransaction {
    serializedTx: string;
    hash: string;
}
export interface AddBtcAddressesRequest extends SimpleRequest {
    chain: 'internal' | 'external';
    firstIndex: number;
}
export interface AddBtcAddressesResult {
    addresses: string[];
}
/**
 * Polygon
 */
export interface SignPolygonTransactionRequest extends BasicRequest, RelayRequest {
    recipientLabel?: string;
    /**
     * The sender's nonce in the token contract, required when calling the
     * contract function `executeWithApproval`.
     */
    approval?: {
        tokenNonce: number;
    };
}
export interface SignedPolygonTransaction {
    message: Record<string, any>;
    signature: string;
}
export declare type RpcRequest = SignTransactionRequest | SignStakingRequest | CreateCashlinkRequest | ManageCashlinkRequest | CheckoutRequest | BasicRequest | SimpleRequest | ChooseAddressRequest | OnboardRequest | RenameRequest | SignMessageRequest | ExportRequest | SignBtcTransactionRequest | AddBtcAddressesRequest | SignPolygonTransactionRequest | SetupSwapRequest | RefundSwapRequest;
export declare type RpcResult = SignedTransaction | Account | Account[] | SimpleResult | ChooseAddressResult | Address | Cashlink | Cashlink[] | SignedMessage | ExportResult | SignedBtcTransaction | AddBtcAddressesResult | SignedPolygonTransaction | SetupSwapResult;
export declare type ResultByRequestType<T> = T extends RequestType.RENAME ? Account : T extends RequestType.ONBOARD | RequestType.SIGNUP | RequestType.LOGIN | RequestType.MIGRATE | RequestType.LIST ? Account[] : T extends RequestType.LIST_CASHLINKS ? Cashlink[] : T extends RequestType.CHOOSE_ADDRESS | RequestType.ADD_ADDRESS ? Address : T extends RequestType.SIGN_TRANSACTION ? SignedTransaction : T extends RequestType.SIGN_STAKING ? SignedTransaction : T extends RequestType.CHECKOUT ? SignedTransaction | SimpleResult : T extends RequestType.SIGN_MESSAGE ? SignedMessage : T extends RequestType.LOGOUT | RequestType.CHANGE_PASSWORD ? SimpleResult : T extends RequestType.EXPORT ? ExportResult : T extends RequestType.CREATE_CASHLINK | RequestType.MANAGE_CASHLINK ? Cashlink : T extends RequestType.SIGN_BTC_TRANSACTION ? SignedBtcTransaction : T extends RequestType.SIGN_POLYGON_TRANSACTION ? SignedPolygonTransaction : T extends RequestType.ACTIVATE_BITCOIN ? Account : T extends RequestType.ACTIVATE_POLYGON ? Account : T extends RequestType.ADD_BTC_ADDRESSES ? AddBtcAddressesResult : T extends RequestType.SETUP_SWAP ? SetupSwapResult : never;
