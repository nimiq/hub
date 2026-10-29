import type * as Nimiq from '@nimiq/core';
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
export type Bytes = Uint8Array | string;
type HexString = string;
type IntString = string;
type PolygonAddress = string;
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
/**
 * Info for a single transaction entry of a request's `transactions` array. Mirrors the Keyguard's TransactionInfo (see
 * Keyguard client/src/PublicRequest.ts), except that entries carry no sender address: the request-level `sender`
 * determines the signer for all transactions and is inherited by all entries. As in the Keyguard, entries carry no
 * labels; for requests with a single transaction, labels can be set at the request level.
 */
export interface TransactionInfo {
    senderType?: Nimiq.AccountType;
    senderData?: Bytes;
    recipient: string;
    recipientType?: Nimiq.AccountType;
    recipientData?: Bytes;
    value: number;
    fee?: number;
    flags?: number;
    validityStartHeight: number;
}
export interface SignTransactionRequestSingle extends BasicRequest {
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
export interface SignTransactionRequestStandard extends BasicRequest {
    layout?: 'standard';
    sender: string;
    transactions: Array<TransactionInfo | Uint8Array>;
    recipientLabel?: string;
}
export interface SignTransactionRequestSwitchValidator extends BasicRequest {
    layout: 'switch-validator';
    sender: string;
    transactions: Array<TransactionInfo | Uint8Array>;
    senderLabel?: string;
    recipientLabel?: string;
    validatorImageUrl?: string;
    fromValidatorAddress: string;
    fromValidatorImageUrl?: string;
}
export interface SignTransactionRequestUnstaking extends BasicRequest {
    layout: 'unstaking';
    sender: string;
    transactions: Array<TransactionInfo | Uint8Array>;
    senderLabel?: string;
    validatorAddress: string;
    validatorImageUrl?: string;
}
export type SignTransactionRequest = SignTransactionRequestSingle | SignTransactionRequestStandard | SignTransactionRequestSwitchValidator | SignTransactionRequestUnstaking;
export interface SignStakingRequest extends BasicRequest {
    senderLabel?: string;
    recipientLabel?: string;
    transaction: Uint8Array | Uint8Array[];
    validatorAddress?: string;
    fromValidatorAddress?: string;
    validatorImageUrl?: string;
    fromValidatorImageUrl?: string;
    amount?: number;
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
export type ProtocolSpecificsForCurrency<C extends Currency> = C extends Currency.NIM ? NimiqSpecifics : C extends Currency.BTC ? BitcoinSpecifics : C extends Currency.ETH ? EtherSpecifics : undefined;
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
export type AvailablePaymentOptions = NimiqDirectPaymentOptions | EtherDirectPaymentOptions | BitcoinDirectPaymentOptions;
export type PaymentOptionsForCurrencyAndType<C extends Currency, T extends PaymentType> = T extends PaymentType.DIRECT ? C extends Currency.NIM ? NimiqDirectPaymentOptions : C extends Currency.BTC ? BitcoinDirectPaymentOptions : C extends Currency.ETH ? EtherDirectPaymentOptions : PaymentOptions<C, T> : PaymentOptions<C, T>;
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
export type CheckoutRequest = NimiqCheckoutRequest | MultiCurrencyCheckoutRequest;
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
export interface RsaKeyParams {
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
        keyParams: RsaKeyParams;
    };
    userName?: string;
}
export interface SignMultisigTransactionRequest extends BasicRequest {
    signer: string;
    sender: string;
    senderType?: Nimiq.AccountType;
    senderLabel: string;
    senderData?: Bytes;
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
/**
 * A gasless HTLC opening through the GaslessHTLC contract. The HTLC's id, recipient, hash and timeout are taken from
 * the swap's HTLC data. PROVISIONAL: the GaslessHTLC contract does not exist yet, its interface might still change.
 */
export interface PolygonHtlcCreationInstructions {
    type: 'USDC_MATIC' | 'USDT_MATIC';
    request: Pick<PolygonHtlcOpenRequest, 'from' | 'amount' | 'fee' | 'relay'>;
    /**
     * The sender's current permit nonce in the token contract (`nonces(from)`).
     */
    tokenNonce: number;
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
/**
 * A gasless HTLC redeem through the GaslessHTLC contract, to my address `request.from`. The HTLC id is taken from the
 * swap. PROVISIONAL: the GaslessHTLC contract does not exist yet, its interface might still change.
 */
export interface PolygonHtlcSettlementInstructions {
    type: 'USDC_MATIC' | 'USDT_MATIC';
    request: Pick<PolygonHtlcSettlement, 'from' | 'fee' | 'relay'>;
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
/**
 * A gasless HTLC refund through the GaslessHTLC contract. PROVISIONAL: the GaslessHTLC contract does not exist yet, its
 * interface might still change.
 */
export interface PolygonHtlcRefundInstructions {
    type: 'USDC_MATIC' | 'USDT_MATIC';
    request: PolygonHtlcSettlement;
    amount: number;
    token: PolygonAddress;
}
export type HtlcCreationInstructions = NimiqHtlcCreationInstructions | BitcoinHtlcCreationInstructions | PolygonHtlcCreationInstructions | EuroHtlcCreationInstructions;
export type HtlcSettlementInstructions = NimiqHtlcSettlementInstructions | BitcoinHtlcSettlementInstructions | PolygonHtlcSettlementInstructions | EuroHtlcSettlementInstructions;
export type HtlcRefundInstructions = NimiqHtlcRefundInstructions | BitcoinHtlcRefundInstructions | PolygonHtlcRefundInstructions;
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
    usdc?: SignedPolygonHtlcOpen | SignedPolygonHtlcSettlement;
    usdt?: SignedPolygonHtlcOpen | SignedPolygonHtlcSettlement;
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
export type PartialSignature = SignedMessage;
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
export type Contract = VestingContract | HashedTimeLockedContract;
export interface Account {
    accountId: string;
    label: string;
    type: AccountType;
    fileExported: boolean;
    wordsExported: boolean;
    backupCodesExported: boolean;
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
    backupCodesOnly?: boolean;
}
export interface ExportResult {
    fileExported: boolean;
    wordsExported: boolean;
    backupCodesExported: boolean;
}
export interface RenameRequest extends SimpleRequest {
    address?: string;
}
export declare enum CashlinkTheme {
    UNSPECIFIED = 0,// Equivalent to theme being omitted
    STANDARD = 1,
    CHRISTMAS = 2,
    LUNAR_NEW_YEAR = 3,
    EASTER = 4,
    GENERIC = 5,
    BIRTHDAY = 6
}
export declare enum CashlinkCurrency {
    NIM = "nim"
}
export interface Cashlink {
    currency: CashlinkCurrency;
    address: string;
    message: string;
    value: number;
    theme: CashlinkTheme;
    link?: string;
}
export type CreateCashlinkRequest = BasicRequest & {
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
        keyParams: RsaKeyParams;
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
/**
 * A gasless USDC or USDT0 transfer on Polygon through the GaslessTransfer contract and the Nimiq relay,
 * see https://github.com/NimiqToolbox/gas-abstraction. Amounts are in the token's smallest unit (6 decimals).
 */
export interface PolygonGaslessTransfer {
    token: PolygonAddress;
    from: PolygonAddress;
    to: PolygonAddress;
    amount: IntString;
    fee: IntString;
    relay: PolygonAddress;
    /**
     * The intent nonce. It identifies the payment: every version of a payment keeps it, so that at most one version
     * can execute. For a new payment, it is the sender's current `nonces(from)` in the GaslessTransfer contract, read
     * on-chain right before, and only once the sender's previous payment is decided. For a new version of a payment,
     * it is the nonce of `corrects`.
     */
    nonce: IntString;
}
/**
 * A signed transfer intent.
 */
export interface PolygonGaslessTransferRequest extends PolygonGaslessTransfer {
    deadline: IntString;
}
/**
 * The redeem or refund of a USDC or USDT0 HTLC through the GaslessHTLC contract. PROVISIONAL: the GaslessHTLC contract
 * does not exist yet, its interface might still change.
 */
export interface PolygonHtlcSettlement {
    from: PolygonAddress;
    id: HexString;
    target: PolygonAddress;
    fee: IntString;
    relay: PolygonAddress;
}
/**
 * A signed HTLC redeem or refund. A redeem does not include the secret, which is submitted alongside.
 */
export interface PolygonHtlcSettlementRequest extends PolygonHtlcSettlement {
    deadline: IntString;
}
/**
 * A signed HTLC opening. `from` is the HTLC's refund address and pays `amount` into the HTLC and `fee` to the relay.
 */
export interface PolygonHtlcOpenRequest {
    token: PolygonAddress;
    from: PolygonAddress;
    id: HexString;
    recipient: PolygonAddress;
    amount: IntString;
    hash: HexString;
    timeout: IntString;
    fee: IntString;
    relay: PolygonAddress;
    deadline: IntString;
}
export interface PolygonTokenPermit {
    mode: 'permit';
    v: number;
    r: HexString;
    s: HexString;
}
export interface SignPolygonGaslessTransferRequest extends BasicRequest {
    operation?: 'transfer';
    request: PolygonGaslessTransfer;
    /**
     * The sender's current permit nonce in the token contract (`nonces(from)`).
     */
    tokenNonce: number;
    /**
     * The payment's latest signed version, when signing a new version of an existing payment, for example with a
     * higher fee. The new version keeps the payment's nonce, token and recipient. Only request this after checking
     * on-chain that the payment's nonce is still unused (`nonces(from)` is not above it).
     */
    corrects?: PolygonGaslessTransferRequest;
    recipientLabel?: string;
}
/**
 * Redeems or refunds an HTLC, for example to re-sign the redeem of a swap.
 */
export interface SignPolygonHtlcSettlementRequest extends BasicRequest {
    operation: 'redeem' | 'refund';
    request: PolygonHtlcSettlement;
    token: PolygonAddress;
    amount: IntString;
    senderLabel?: string;
}
export type SignPolygonTransactionRequest = SignPolygonGaslessTransferRequest | SignPolygonHtlcSettlementRequest;
/**
 * The signed transfer in the shape of the relay's POST /v1/transfer body. It contains a token permit, so do not
 * persist or log it.
 */
export interface SignedPolygonGaslessTransfer {
    request: PolygonGaslessTransferRequest;
    signature: HexString;
    authorization: PolygonTokenPermit;
}
/**
 * A signed HTLC opening. It contains a token permit, so do not log it.
 */
export interface SignedPolygonHtlcOpen {
    request: PolygonHtlcOpenRequest;
    signature: HexString;
    authorization: PolygonTokenPermit;
}
export interface SignedPolygonHtlcSettlement {
    request: PolygonHtlcSettlementRequest;
    signature: HexString;
}
export type SignedPolygonTransaction = SignedPolygonGaslessTransfer | SignedPolygonHtlcSettlement;
export type RpcRequest = SignTransactionRequest | SignMultisigTransactionRequest | SignStakingRequest | CreateCashlinkRequest | ManageCashlinkRequest | CheckoutRequest | BasicRequest | SimpleRequest | ChooseAddressRequest | OnboardRequest | RenameRequest | SignMessageRequest | ExportRequest | SignBtcTransactionRequest | AddBtcAddressesRequest | SignPolygonTransactionRequest | SetupSwapRequest | RefundSwapRequest | ConnectAccountRequest;
export type RpcResult = SignedTransaction | SignedTransaction[] | PartialSignature | Account | Account[] | SimpleResult | ChooseAddressResult | Address | Cashlink | Cashlink[] | SignedMessage | ExportResult | SignedBtcTransaction | AddBtcAddressesResult | SignedPolygonTransaction | SignedPolygonHtlcOpen | SetupSwapResult | ConnectedAccount;
export type ResultByRequestType<T> = T extends RequestType.RENAME ? Account : T extends RequestType.ONBOARD | RequestType.SIGNUP | RequestType.LOGIN | RequestType.MIGRATE | RequestType.LIST ? Account[] : T extends RequestType.LIST_CASHLINKS ? Cashlink[] : T extends RequestType.CHOOSE_ADDRESS ? ChooseAddressResult : T extends RequestType.ADD_ADDRESS ? Address : T extends RequestType.SIGN_TRANSACTION ? SignedTransaction | SignedTransaction[] : T extends RequestType.SIGN_MULTISIG_TRANSACTION ? PartialSignature : T extends RequestType.SIGN_STAKING ? SignedTransaction[] : T extends RequestType.CHECKOUT ? SignedTransaction | SimpleResult : T extends RequestType.SIGN_MESSAGE ? SignedMessage : T extends RequestType.LOGOUT | RequestType.CHANGE_PASSWORD ? SimpleResult : T extends RequestType.EXPORT ? ExportResult : T extends RequestType.CREATE_CASHLINK | RequestType.MANAGE_CASHLINK ? Cashlink : T extends RequestType.SIGN_BTC_TRANSACTION ? SignedBtcTransaction : T extends RequestType.SIGN_POLYGON_TRANSACTION ? SignedPolygonTransaction : T extends RequestType.ACTIVATE_BITCOIN ? Account : T extends RequestType.ACTIVATE_POLYGON ? Account : T extends RequestType.ADD_BTC_ADDRESSES ? AddBtcAddressesResult : T extends RequestType.SETUP_SWAP ? SetupSwapResult : T extends RequestType.CONNECT_ACCOUNT ? ConnectedAccount : never;
