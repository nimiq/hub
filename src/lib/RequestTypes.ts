import { WalletType, WalletInfoEntry } from './WalletInfo';
import { TX_VALIDITY_WINDOW, TX_MIN_VALIDITY_DURATION } from './Constants';
import { State } from '@nimiq/rpc';

export enum RequestType {
    LIST = 'list',
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
    CHOOSE_ADDRESS = 'choose-address',
}

export interface SimpleRequest {
    kind?: RequestType.ONBOARD | RequestType.SIGNUP | RequestType.LOGIN | RequestType.CHOOSE_ADDRESS;
    appName: string;
}

export interface SimpleResult {
    success: true;
}

export interface SignTransactionRequest {
    kind?: RequestType.SIGN_TRANSACTION;
    appName: string;
    accountId: string;
    sender: string;
    recipient: string;
    recipientType?: Nimiq.Account.Type;
    value: number;
    fee?: number;
    extraData?: Uint8Array;
    flags?: number;
    validityStartHeight: number; // FIXME To be made optional when accounts manager has its own network
}

export interface ParsedSignTransactionRequest {
    kind: RequestType.SIGN_TRANSACTION;
    appName: string;
    walletId: string;
    sender: Nimiq.Address;
    recipient: Nimiq.Address;
    recipientType?: Nimiq.Account.Type;
    value: number;
    fee?: number;
    data?: Uint8Array;
    flags?: number;
    validityStartHeight: number; // FIXME To be made optional when accounts manager has its own network
}

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
    };
}

export interface CheckoutRequest {
    kind?: RequestType.CHECKOUT;
    appName: string;
    shopLogoUrl?: string;
    recipient: string;
    recipientType?: Nimiq.Account.Type;
    value: number;
    fee?: number;
    extraData?: Uint8Array;
    flags?: number;
    validityDuration?: number;
}

export interface ParsedCheckoutRequest {
    kind: RequestType.CHECKOUT;
    appName: string;
    shopLogoUrl?: string;
    recipient: Nimiq.Address;
    recipientType?: Nimiq.Account.Type;
    value: number;
    fee?: number;
    data?: Uint8Array;
    flags?: number;
    validityDuration: number;
}

export interface SignMessageRequest {
    kind?: RequestType.SIGN_MESSAGE;
    appName: string;
    accountId?: string;
    signer?: string;
    message: string | Uint8Array;
}

export interface ParsedSignMessageRequest {
    kind: RequestType.SIGN_MESSAGE;
    appName: string;
    walletId?: string;
    signer?: Nimiq.Address;
    message: string | Uint8Array;
}

export interface SignedMessage {
    signer: string; // Userfriendly address
    signerPubKey: Uint8Array;
    signature: Uint8Array;
    message: string | Uint8Array;
}

export interface ParsedOnboardingRequest {
    kind: RequestType.ONBOARD;
    appName: string;
}

export interface ParsedChooseAddressRequest {
    kind: RequestType.CHOOSE_ADDRESS;
    appName: string;
}

export interface ParsedSignupRequest {
    kind: RequestType.SIGNUP;
    appName: string;
}

export interface ParsedLoginRequest {
    kind: RequestType.LOGIN;
    appName: string;
}

export interface Address {
    address: string; // Userfriendly address
    label: string;
}

export interface Account {
    accountId: string;
    label: string;
    type: WalletType;
    fileExported: boolean;
    wordsExported: boolean;
    addresses: Address[];
}

export interface ExportRequest {
    kind?: RequestType.EXPORT;
    appName: string;
    accountId: string;
}

export interface ParsedExportRequest {
    kind: RequestType.EXPORT;
    appName: string;
    walletId: string;
}

export interface ChangePasswordRequest {
    kind?: RequestType.CHANGE_PASSWORD;
    appName: string;
    accountId: string;
}

export interface ParsedChangePasswordRequest {
    kind: RequestType.CHANGE_PASSWORD;
    appName: string;
    walletId: string;
}

export interface LogoutRequest {
    kind?: RequestType.LOGOUT;
    appName: string;
    accountId: string;
}

export interface ParsedLogoutRequest {
    kind: RequestType.LOGOUT;
    appName: string;
    walletId: string;
}

export interface AddAddressRequest {
    kind?: RequestType.ADD_ADDRESS;
    appName: string;
    accountId: string;
}

export interface ParsedAddAccountRequest {
    kind: RequestType.ADD_ADDRESS;
    appName: string;
    walletId: string;
}

export interface RenameRequest {
    kind?: RequestType.RENAME;
    appName: string;
    accountId: string;
    address?: string;
}

export interface ParsedRenameRequest {
    kind: RequestType.RENAME;
    appName: string;
    walletId: string;
    address?: string;
}

export interface MigrateRequest {
    kind?: RequestType.MIGRATE;
}
export interface ParsedMigrateRequest {
    kind: RequestType.MIGRATE;
}

export interface ExportResult {
    fileExported: boolean;
    wordsExported: boolean;
}

export type ListResult = WalletInfoEntry[];

// Discriminated Unions
export type RpcRequest = SignTransactionRequest
                       | CheckoutRequest
                       | SimpleRequest
                       | ExportRequest
                       | ChangePasswordRequest
                       | LogoutRequest
                       | AddAddressRequest
                       | RenameRequest
                       | SignMessageRequest
                       | MigrateRequest;

export type ParsedRpcRequest = ParsedSignTransactionRequest
                             | ParsedCheckoutRequest
                             | ParsedOnboardingRequest
                             | ParsedChooseAddressRequest
                             | ParsedSignupRequest
                             | ParsedLoginRequest
                             | ParsedExportRequest
                             | ParsedChangePasswordRequest
                             | ParsedLogoutRequest
                             | ParsedAddAccountRequest
                             | ParsedRenameRequest
                             | ParsedSignMessageRequest
                             | ParsedMigrateRequest;

export type RpcResult = SignedTransaction
                      | Account
                      | SimpleResult
                      | Address
                      | SignedMessage
                      | ExportResult
                      | ListResult;

export class AccountsRequest {
    public static parse(request: RpcRequest, state: State, requestType?: RequestType): ParsedRpcRequest | null {
        switch (request.kind || requestType) {
            case RequestType.SIGN_TRANSACTION:
                // Because the switch statement is not definitely using 'request.kind' as the condition,
                // Typescript cannot infer what type the request variable is from the control flow,
                // thus we need to force-cast it here:
                request = request as SignTransactionRequest;
                return {
                    kind: RequestType.SIGN_TRANSACTION,
                    appName: request.appName,
                    walletId: request.accountId,
                    sender: Nimiq.Address.fromUserFriendlyAddress(request.sender),
                    recipient: Nimiq.Address.fromUserFriendlyAddress(request.recipient),
                    recipientType: request.recipientType,
                    value: request.value,
                    fee: request.fee,
                    data: request.extraData,
                    flags: request.flags,
                    validityStartHeight: request.validityStartHeight,
                } as ParsedSignTransactionRequest;
            case RequestType.CHECKOUT:
                // Because the switch statement is not definitely using 'request.kind' as the condition,
                // Typescript cannot infer what type the request variable is from the control flow,
                // thus we need to force-cast it here:
                request = request as CheckoutRequest;
                if (request.shopLogoUrl && new URL(request.shopLogoUrl).origin !== state.origin) {
                    throw new Error(
                        'shopLogoUrl must have same origin as caller website. Image at ' +
                        request.shopLogoUrl +
                        ' is not on caller origin ' +
                        state.origin);
                }
                return {
                    kind: RequestType.CHECKOUT,
                    appName: request.appName,
                    shopLogoUrl: request.shopLogoUrl,
                    recipient: Nimiq.Address.fromUserFriendlyAddress(request.recipient),
                    recipientType: request.recipientType,
                    value: request.value,
                    fee: request.fee,
                    data: request.extraData,
                    flags: request.flags,
                    validityDuration: !request.validityDuration ? TX_VALIDITY_WINDOW : Math.min(
                        TX_VALIDITY_WINDOW,
                        Math.max(
                            TX_MIN_VALIDITY_DURATION,
                            request.validityDuration,
                        ),
                    ),
                } as ParsedCheckoutRequest;
            case RequestType.ONBOARD:
                request = request as SimpleRequest;
                return {
                    kind: RequestType.ONBOARD,
                    appName: request.appName,
                } as ParsedOnboardingRequest;
            case RequestType.SIGNUP:
                request = request as SimpleRequest;
                return {
                    kind: RequestType.SIGNUP,
                    appName: request.appName,
                } as ParsedSignupRequest;
            case RequestType.CHOOSE_ADDRESS:
                request = request as SimpleRequest;
                return {
                    kind: RequestType.CHOOSE_ADDRESS,
                    appName: request.appName,
                } as ParsedChooseAddressRequest;
            case RequestType.LOGIN:
                request = request as SimpleRequest;
                return {
                    kind: RequestType.LOGIN,
                    appName: request.appName,
                } as ParsedLoginRequest;
            case RequestType.EXPORT:
                request = request as ExportRequest;
                return {
                    kind: RequestType.EXPORT,
                    appName: request.appName,
                    walletId: request.accountId,
                } as ParsedExportRequest;
            case RequestType.CHANGE_PASSWORD:
                request = request as ChangePasswordRequest;
                return {
                    kind: RequestType.CHANGE_PASSWORD,
                    appName: request.appName,
                    walletId: request.accountId,
                } as ParsedChangePasswordRequest;
            case RequestType.LOGOUT:
                request = request as LogoutRequest;
                return {
                    kind: RequestType.LOGOUT,
                    appName: request.appName,
                    walletId: request.accountId,
                } as ParsedLogoutRequest;
            case RequestType.ADD_ADDRESS:
                request = request as AddAddressRequest;
                return {
                    kind: RequestType.ADD_ADDRESS,
                    appName: request.appName,
                    walletId: request.accountId,
                } as ParsedAddAccountRequest;
            case RequestType.RENAME:
                request = request as RenameRequest;
                return {
                    kind: RequestType.RENAME,
                    appName: request.appName,
                    walletId: request.accountId,
                    address: request.address,
                } as ParsedRenameRequest;
            case RequestType.SIGN_MESSAGE:
                request = request as SignMessageRequest;
                if (typeof request.message !== 'string' && !(request.message instanceof Uint8Array)) {
                    throw new Error('message must be a string or Uint8Array');
                }
                return {
                    kind: RequestType.SIGN_MESSAGE,
                    appName: request.appName,
                    walletId: request.accountId,
                    signer: request.signer ? Nimiq.Address.fromUserFriendlyAddress(request.signer) : undefined,
                    message: request.message,
                } as ParsedSignMessageRequest;
            case RequestType.MIGRATE:
                request = request as MigrateRequest;
                return {
                    kind: RequestType.MIGRATE,
                } as ParsedMigrateRequest;
            default:
                return null;
        }
    }

    public static raw(request: ParsedRpcRequest): RpcRequest | null {
        switch (request.kind) {
            case RequestType.SIGN_TRANSACTION:
                return {
                    kind: RequestType.SIGN_TRANSACTION,
                    appName: request.appName,
                    accountId: request.walletId,
                    sender: request.sender.toUserFriendlyAddress(),
                    recipient: request.recipient.toUserFriendlyAddress(),
                    recipientType: request.recipientType,
                    value: request.value,
                    fee: request.fee,
                    extraData: request.data,
                    flags: request.flags,
                    validityStartHeight: request.validityStartHeight,
                } as SignTransactionRequest;
            case RequestType.CHECKOUT:
                return {
                    kind: RequestType.CHECKOUT,
                    appName: request.appName,
                    shopLogoUrl: request.shopLogoUrl,
                    recipient: request.recipient.toUserFriendlyAddress(),
                    recipientType: request.recipientType,
                    value: request.value,
                    fee: request.fee,
                    extraData: request.data,
                    flags: request.flags,
                    validityDuration: request.validityDuration,
                } as CheckoutRequest;
            case RequestType.ONBOARD:
                return {
                    kind: RequestType.ONBOARD,
                    appName: request.appName,
                } as SimpleRequest;
            case RequestType.SIGNUP:
                return {
                    kind: RequestType.SIGNUP,
                    appName: request.appName,
                } as SimpleRequest;
            case RequestType.CHOOSE_ADDRESS:
                return {
                    kind: RequestType.CHOOSE_ADDRESS,
                    appName: request.appName,
                } as SimpleRequest;
            case RequestType.LOGIN:
                return {
                    kind: RequestType.LOGIN,
                    appName: request.appName,
                } as SimpleRequest;
            case RequestType.EXPORT:
            case RequestType.CHANGE_PASSWORD:
            case RequestType.LOGOUT:
            case RequestType.ADD_ADDRESS:
                // @ts-ignore
                return {
                    kind: request.kind,
                    appName: request.appName,
                    accountId: request.walletId,
                }; // TODO `as SimpleRequest` after refactor into Basic- and SimpleRequests
            case RequestType.RENAME:
                return {
                    kind: RequestType.RENAME,
                    appName: request.appName,
                    accountId: request.walletId,
                    address: request.address,
                } as RenameRequest;
            case RequestType.SIGN_MESSAGE:
                return {
                    kind: RequestType.SIGN_MESSAGE,
                    appName: request.appName,
                    accountId: request.walletId,
                    signer: request.signer ? request.signer.toUserFriendlyAddress() : undefined,
                    message: request.message,
                } as SignMessageRequest;
            case RequestType.MIGRATE:
                return request as MigrateRequest;
            default:
                return null;
        }
    }
}
