import { WalletType } from './Constants';

type NimiqSpecifics = import('./paymentOptions/NimiqPaymentOptions').NimiqSpecifics;
type NimiqDirectPaymentOptions = import('./paymentOptions/NimiqPaymentOptions').NimiqDirectPaymentOptions;
type BitcoinSpecifics = import('./paymentOptions/BitcoinPaymentOptions').BitcoinSpecifics;
type BitcoinDirectPaymentOptions = import('./paymentOptions/BitcoinPaymentOptions').BitcoinDirectPaymentOptions;
type EtherSpecifics = import('./paymentOptions/EtherPaymentOptions').EtherSpecifics;
type EtherDirectPaymentOptions = import('./paymentOptions/EtherPaymentOptions').EtherDirectPaymentOptions;

export enum RequestType {
    LIST = 'list',
    LIST_CASHLINKS = 'list-cashlinks',
    MIGRATE = 'migrate',
    CHECKOUT = 'checkout',
    SIGN_MESSAGE = 'sign-message',
    SIGN_TRANSACTION = 'sign-transaction',
    ONBOARD = 'onboard',
    SIGNUP = 'signup',
    LOGIN = 'login',
    EXPORT = 'export',
    CHANGE_PASSWORD = 'change-password',
    LOGOUT = 'logout',
    ADD_ADDRESS = 'add-address',
    RENAME = 'rename',
    ADD_VESTING_CONTRACT = 'add-vesting-contract',
    CHOOSE_ADDRESS = 'choose-address',
    CREATE_CASHLINK = 'create-cashlink',
    MANAGE_CASHLINK = 'manage-cashlink',
    SIGN_BTC_TRANSACTION = 'sign-btc-transaction',
    ADD_BTC_ADDRESSES = 'add-btc-addresses',
    ACTIVATE_BITCOIN = 'activate-bitcoin',
    SETUP_SWAP = 'setup-swap',
    REFUND_SWAP = 'refund-swap',
}

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

export interface SignTransactionRequest extends BasicRequest {
    sender: string;
    recipient: string;
    recipientType?: Nimiq.Account.Type;
    recipientLabel?: string;
    value: number;
    fee?: number;
    extraData?: Uint8Array | string;
    flags?: number;
    validityStartHeight: number; // FIXME To be made optional when hub has its own network
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
    extraData?: Uint8Array | string;
    flags?: number;
    validityDuration?: number;
    disableDisclaimer?: boolean; // only allowed for privileged origins
}

export enum PaymentType {
    DIRECT,
    OASIS,
}

export enum Currency {
    NIM = 'nim',
    BTC = 'btc',
    ETH = 'eth',
}

export type ProtocolSpecificsForCurrency<C extends Currency> =
    C extends Currency.NIM ? NimiqSpecifics
    : C extends Currency.BTC ? BitcoinSpecifics
    : C extends Currency.ETH ? EtherSpecifics
    : undefined;

export enum PaymentState {
    NOT_FOUND = 'NOT_FOUND',
    PAID = 'PAID',
    UNDERPAID = 'UNDERPAID',
    OVERPAID = 'OVERPAID',
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

export type AvailablePaymentOptions = NimiqDirectPaymentOptions
                                    | EtherDirectPaymentOptions
                                    | BitcoinDirectPaymentOptions;

export type PaymentOptionsForCurrencyAndType<C extends Currency, T extends PaymentType> =
    T extends PaymentType.DIRECT ?
        C extends Currency.NIM ? NimiqDirectPaymentOptions
        : C extends Currency.BTC ? BitcoinDirectPaymentOptions
        : C extends Currency.ETH ? EtherDirectPaymentOptions
        : PaymentOptions<C, T>
    : PaymentOptions<C, T>;

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
    extraData?: Uint8Array | string;
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
     * Option to disable the disclaimer at the bottom of the checkout page. Only allowed for privileged origins.
     */
    disableDisclaimer?: boolean; // only allowed for privileged origins
}

export type CheckoutRequest = NimiqCheckoutRequest | MultiCurrencyCheckoutRequest;

export interface SignedTransaction {
    serializedTx: string; // HEX
    hash: string; // HEX

    raw: {
        signerPublicKey: Uint8Array;
        signature: Uint8Array;

        sender: string; // Userfriendly address
        senderType: Nimiq.Account.Type;
        recipient: string; // Userfriendly address
        recipientType: Nimiq.Account.Type;
        value: number; // Luna
        fee: number; // Luna
        validityStartHeight: number;
        extraData: Uint8Array;
        flags: number;
        networkId: number;
        proof: Uint8Array;
    };
}

export interface NimiqHtlcCreationInstructions {
    type: 'NIM';
    sender: string; // My address, must be redeem address of HTLC, or if contract, its owner must be redeem address
    value: number; // Luna
    fee: number; // Luna
    validityStartHeight: number;
}

export interface BitcoinHtlcCreationInstructions {
    type: 'BTC';
    inputs: Array<{
        address: string,
        transactionHash: string,
        outputIndex: number,
        outputScript: string,
        value: number, // Sats
    }>;
    output: {
        value: number, // Sats
    };
    changeOutput?: {
        address: string,
        value: number, // Sats
    };
    refundAddress: string;
}

export interface NimiqHtlcSettlementInstructions {
    type: 'NIM';
    recipient: string; // My address, must be redeem address of HTLC
    value: number; // Luna
    fee: number; // Luna
    extraData?: Uint8Array | string;
    validityStartHeight: number;
}

export interface BitcoinHtlcSettlementInstructions {
    type: 'BTC';
    input: {
        // transactionHash: string,
        // outputIndex: number,
        // outputScript: string,
        value: number, // Sats
    };
    output: {
        address: string, // My address, must be redeem address of HTLC
        value: number, // Sats
    };
}

export interface NimiqHtlcRefundInstructions {
    type: 'NIM';
    sender: string; // HTLC address
    recipient: string; // My address, must be refund address of HTLC
    value: number; // Luna
    fee: number; // Luna
    extraData?: Uint8Array | string;
    validityStartHeight: number;
}

export interface BitcoinHtlcRefundInstructions {
    type: 'BTC';
    input: {
        transactionHash: string,
        outputIndex: number,
        outputScript: string,
        address: string, // HTLC address
        value: number, // Sats
        witnessScript: string,
    };
    output: {
        address: string, // My address
        value: number, // Sats
    };
    refundAddress: string; // My address, must be refund address of HTLC
}

export type HtlcCreationInstructions =
    NimiqHtlcCreationInstructions
    | BitcoinHtlcCreationInstructions;

export type HtlcSettlementInstructions =
    NimiqHtlcSettlementInstructions
    | BitcoinHtlcSettlementInstructions;

export type HtlcRefundInstructions =
    NimiqHtlcRefundInstructions
    | BitcoinHtlcRefundInstructions;

export interface SetupSwapRequest extends BasicRequest {
    swapId: string;
    fund: HtlcCreationInstructions;
    redeem: HtlcSettlementInstructions;

    // Data needed for display
    fiatCurrency: string;
    nimFiatRate: number;
    btcFiatRate: number;
    serviceFundingNetworkFee: number; // Luna or Sats, depending which one gets funded
    serviceRedeemingNetworkFee: number; // Luna or Sats, depending which one gets redeemed
    serviceExchangeFee: number; // Luna or Sats, depending which one gets funded
    nimiqAddresses: Array<{
        address: string,
        balance: number, // Luna
    }>;
    bitcoinAccount: {
        balance: number, // Sats
    };
}

export interface SetupSwapResult {
    nim: SignedTransaction;
    btc: SignedBtcTransaction;
}

export interface RefundSwapRequest extends SimpleRequest {
    refund: HtlcRefundInstructions;
}

export interface SignMessageRequest extends BasicRequest {
    signer?: string;
    message: string | Uint8Array;
}

export interface SignedMessage {
    signer: string; // Userfriendly address
    signerPublicKey: Uint8Array;
    signature: Uint8Array;
}

export interface Address {
    address: string; // Userfriendly address
    label: string;
}

export interface VestingContract {
    type: Nimiq.Account.Type.VESTING;
    address: string; // Userfriendly address
    label: string;

    owner: string; // Userfriendly address
    start: number;
    stepAmount: number;
    stepBlocks: number;
    totalAmount: number;
}

export interface HashedTimeLockedContract {
    type: Nimiq.Account.Type.HTLC;
    address: string; // Userfriendly address
    label: string;

    sender: string;  // Userfriendly address
    recipient: string;  // Userfriendly address
    hashRoot: string; // HEX
    hashCount: number;
    timeout: number;
    totalAmount: number;
}

export type Contract = VestingContract | HashedTimeLockedContract;

export interface Account {
    accountId: string;
    label: string;
    type: WalletType;
    fileExported: boolean;
    wordsExported: boolean;
    addresses: Address[];
    contracts: Contract[];
    btcAddresses: {
        internal: string[],
        external: string[],
    };
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
    address?: string; // Userfriendly address
}

export enum CashlinkState {
    UNKNOWN = -1,
    UNCHARGED = 0,
    CHARGING = 1,
    UNCLAIMED = 2,
    CLAIMING = 3,
    CLAIMED = 4,
}

export enum CashlinkTheme {
    UNSPECIFIED, // Equivalent to theme being omitted
    STANDARD,
    CHRISTMAS,
    LUNAR_NEW_YEAR,
    EASTER,
    GENERIC,
    BIRTHDAY,
}

export interface Cashlink {
    address: string; // Userfriendly address
    message: string;
    value: number;
    status: CashlinkState;
    theme: CashlinkTheme;
    link?: string;
}

export type CreateCashlinkRequest = BasicRequest & {
    value?: number,
    theme?: CashlinkTheme,
} & (
    {} | {
        message: string,
        autoTruncateMessage?: boolean,
    }
) & (
    {} | {
        senderAddress: string,
        senderBalance?: number,
    }
) & ({
        returnLink?: false,
    } | {
        returnLink: true,
        skipSharing?: boolean,
    }
);

export interface ManageCashlinkRequest extends BasicRequest {
    cashlinkAddress: string;
}

/**
 * Bitcoin
 */

export interface SignBtcTransactionRequest extends SimpleRequest {
    inputs: Array<{
        address: string,
        transactionHash: string,
        outputIndex: number,
        outputScript: string,
        value: number,
    }>;
    output: {
        address: string,
        value: number,
        label?: string,
    };
    changeOutput?: {
        address: string,
        value: number,
    };
}

export interface SignedBtcTransaction {
    serializedTx: string; // HEX
    hash: string; // HEX
}

export interface AddBtcAddressesRequest extends SimpleRequest {
    chain: 'internal' | 'external';
    firstIndex: number;
}

export interface AddBtcAddressesResult {
    addresses: string[];
}

export type RpcRequest = SignTransactionRequest
                       | CreateCashlinkRequest
                       | ManageCashlinkRequest
                       | CheckoutRequest
                       | BasicRequest
                       | SimpleRequest
                       | OnboardRequest
                       | RenameRequest
                       | SignMessageRequest
                       | ExportRequest
                       | SignBtcTransactionRequest
                       | AddBtcAddressesRequest
                       | SetupSwapRequest
                       | RefundSwapRequest;

export type RpcResult = SignedTransaction
                      | Account
                      | Account[]
                      | SimpleResult
                      | Address
                      | Cashlink
                      | Cashlink[]
                      | SignedMessage
                      | ExportResult
                      | SignedBtcTransaction
                      | AddBtcAddressesResult
                      | SetupSwapResult;

export type ResultByRequestType<T> =
    T extends RequestType.RENAME ? Account :
    T extends RequestType.ONBOARD | RequestType.SIGNUP | RequestType.LOGIN
            | RequestType.MIGRATE | RequestType.LIST ? Account[] :
    T extends RequestType.LIST_CASHLINKS ? Cashlink[] :
    T extends RequestType.CHOOSE_ADDRESS | RequestType.ADD_ADDRESS ? Address :
    T extends RequestType.SIGN_TRANSACTION ? SignedTransaction :
    T extends RequestType.CHECKOUT ? SignedTransaction | SimpleResult :
    T extends RequestType.SIGN_MESSAGE ? SignedMessage :
    T extends RequestType.LOGOUT | RequestType.CHANGE_PASSWORD ? SimpleResult :
    T extends RequestType.EXPORT ? ExportResult :
    T extends RequestType.CREATE_CASHLINK | RequestType.MANAGE_CASHLINK ? Cashlink :
    T extends RequestType.SIGN_BTC_TRANSACTION ? SignedBtcTransaction :
    T extends RequestType.ACTIVATE_BITCOIN ? Account :
    T extends RequestType.ADD_BTC_ADDRESSES ? AddBtcAddressesResult :
    T extends RequestType.SETUP_SWAP ? SetupSwapResult :
    never;
