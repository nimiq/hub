import type * as Nimiq from '@nimiq/core';
import type { RelayRequest } from '@opengsn/common/dist/EIP712/RelayRequest';
import { NimiqSpecifics, NimiqDirectPaymentOptions, BitcoinSpecifics, BitcoinDirectPaymentOptions, EtherSpecifics, EtherDirectPaymentOptions } from './PublicPaymentOptions';
export declare enum RequestType {
    LIST = "list",
    LIST_CASHLINKS = "list-cashlinks",
    MIGRATE = "migrate",
    CHECKOUT = "checkout",
    SIGN_MESSAGE = "sign-message",
    SIGN_TRANSACTION = "sign-transaction",
    SIGN_MULTISIG_TRANSACTION = "sign-multisig-transaction",
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
    REFUND_SWAP = "refund-swap",
    CONNECT_ACCOUNT = "connect-account"
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
    returnUsdcAddress?: boolean;
    minBalance?: number;
    disableContracts?: boolean;
    disableLegacyAccounts?: boolean;
    disableBip39Accounts?: boolean;
    disableLedgerAccounts?: boolean;
    ui?: number;
}
export interface ChooseAddressResult extends Address {
    btcAddress?: string;
    usdcAddress?: string;
    meta: {
        account: {
            label: string;
            color: string;
        };
    };
}
export interface SignTransactionRequest extends BasicRequest {
    sender: string;
    recipient: string;
    recipientType?: Nimiq.AccountType;
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
    transaction: Uint8Array | Uint8Array[];
}
export interface NimiqCheckoutRequest extends BasicRequest {
    version?: 1;
    shopLogoUrl?: string;
    sender?: string;
    forceSender?: boolean;
    recipient: string;
    recipientType?: Nimiq.AccountType;
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
     * The data to be included in the transaction. Ignored for `Currency.BTC` and `Currency.ETH`.
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
        senderType: Nimiq.AccountType;
        recipient: string;
        recipientType: Nimiq.AccountType;
        value: number;
        fee: number;
        validityStartHeight: number;
        extraData: Uint8Array;
        flags: number;
        networkId: number;
        proof: Uint8Array;
    };
}
export interface EncryptionKeyParams {
    kdf: string;
    iterations: number;
    keySize: number;
}
export interface MultisigInfo {
    publicKeys: Bytes[];
    signers: Array<{
        publicKey: Bytes;
        commitments: Bytes[];
    }>;
    secrets: Bytes[] | {
        encrypted: Bytes[];
        keyParams: EncryptionKeyParams;
    };
    userName?: string;
}
export interface SignMultisigTransactionRequest extends BasicRequest {
    signer: string;
    sender: string;
    senderType?: Nimiq.AccountType;
    senderLabel: string;
    recipient: string;
    recipientType?: Nimiq.AccountType;
    recipientLabel?: string;
    value: number;
    fee?: number;
    extraData?: Bytes;
    flags?: number;
    validityStartHeight: number;
    multisigConfig: MultisigInfo;
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
    type: 'USDC_MATIC' | 'USDT_MATIC';
    /**
     * The sender's nonce in the token contract, required when calling the
     * contract function `openWithPermit`.
     */
    permit?: {
        tokenNonce: number;
    };
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
    type: 'USDC_MATIC' | 'USDT_MATIC';
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
    type: 'USDC_MATIC' | 'USDC' | 'USDT_MATIC';
    amount: number;
    /**
     * The token contract address. Required for calling the bridged HTLC contract.
     */
    token: string;
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
        usdcBalance: number;
        usdtBalance: number;
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
    usdt?: SignedPolygonTransaction;
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
export declare type PartialSignature = SignedMessage;
export interface Address {
    address: string;
    label: string;
}
export interface VestingContract {
    type: Nimiq.AccountType.Vesting;
    address: string;
    label: string;
    owner: string;
    startTime: number;
    stepAmount: number;
    timeStep: number;
    totalAmount: number;
}
export interface HashedTimeLockedContract {
    type: Nimiq.AccountType.HTLC;
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
export interface ConnectAccountRequest extends BasicRequest {
    appLogoUrl: string;
    permissions: RequestType[];
    requestedKeyPaths: string[];
    challenge: string;
}
export interface ConnectedAccount {
    signatures: SignedMessage[];
    encryptionKey: {
        format: 'spki';
        keyData: Uint8Array;
        algorithm: {
            name: string;
            hash: string;
        };
        keyUsages: ['encrypt'];
        keyParams: EncryptionKeyParams;
    };
    account: {
        label: string;
        type: string;
    };
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
     * contract function `swapWithApproval` for bridged USDC.e and `transferWithApproval` for bridged USDT.
     */
    approval?: {
        tokenNonce: number;
    };
    /**
     * The sender's nonce in the token contract, required when calling the
     * contract function `transferWithPermit` for native USDC.
     */
    permit?: {
        tokenNonce: number;
    };
    /**
     * The amount of USDC/T to transfer. Required when calling the contract
     * methods 'redeem' and 'redeemWithSecretInData' for HTLCs.
     */
    amount?: number;
    /**
     * The label of the sending address. Required when calling the contract
     * methods 'redeem' and 'redeemWithSecretInData' for HTLCs.
     */
    senderLabel?: string;
    /**
     * The token contract address. Required for calling the bridged HTLC contract.
     */
    token?: string;
}
export interface SignedPolygonTransaction {
    message: Record<string, any>;
    signature: string;
}
export declare type RpcRequest = SignTransactionRequest | SignMultisigTransactionRequest | SignStakingRequest | CreateCashlinkRequest | ManageCashlinkRequest | CheckoutRequest | BasicRequest | SimpleRequest | ChooseAddressRequest | OnboardRequest | RenameRequest | SignMessageRequest | ExportRequest | SignBtcTransactionRequest | AddBtcAddressesRequest | SignPolygonTransactionRequest | SetupSwapRequest | RefundSwapRequest | ConnectAccountRequest;
export declare type RpcResult = SignedTransaction | SignedTransaction[] | PartialSignature | Account | Account[] | SimpleResult | ChooseAddressResult | Address | Cashlink | Cashlink[] | SignedMessage | ExportResult | SignedBtcTransaction | AddBtcAddressesResult | SignedPolygonTransaction | SetupSwapResult | ConnectedAccount;
export declare type ResultByRequestType<T> = T extends RequestType.RENAME ? Account : T extends RequestType.ONBOARD | RequestType.SIGNUP | RequestType.LOGIN | RequestType.MIGRATE | RequestType.LIST ? Account[] : T extends RequestType.LIST_CASHLINKS ? Cashlink[] : T extends RequestType.CHOOSE_ADDRESS ? ChooseAddressResult : T extends RequestType.ADD_ADDRESS ? Address : T extends RequestType.SIGN_TRANSACTION ? SignedTransaction : T extends RequestType.SIGN_MULTISIG_TRANSACTION ? PartialSignature : T extends RequestType.SIGN_STAKING ? SignedTransaction[] : T extends RequestType.CHECKOUT ? SignedTransaction | SimpleResult : T extends RequestType.SIGN_MESSAGE ? SignedMessage : T extends RequestType.LOGOUT | RequestType.CHANGE_PASSWORD ? SimpleResult : T extends RequestType.EXPORT ? ExportResult : T extends RequestType.CREATE_CASHLINK | RequestType.MANAGE_CASHLINK ? Cashlink : T extends RequestType.SIGN_BTC_TRANSACTION ? SignedBtcTransaction : T extends RequestType.SIGN_POLYGON_TRANSACTION ? SignedPolygonTransaction : T extends RequestType.ACTIVATE_BITCOIN ? Account : T extends RequestType.ACTIVATE_POLYGON ? Account : T extends RequestType.ADD_BTC_ADDRESSES ? AddBtcAddressesResult : T extends RequestType.SETUP_SWAP ? SetupSwapResult : T extends RequestType.CONNECT_ACCOUNT ? ConnectedAccount : never;
