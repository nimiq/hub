import { WalletType, WalletInfoEntry } from './WalletInfo';
import { TX_VALIDITY_WINDOW, TX_MIN_VALIDITY_DURATION } from './Constants';
import { State } from '@nimiq/rpc';

export enum RequestType {
    LIST = 'list',
    MIGRATE = 'migrate',
    CHECKOUT = 'checkout',
    SIGN_MESSAGE = 'sign-message',
    SIGN_TRANSACTION = 'sign-transaction',
    SIGNUP = 'signup',
    LOGIN = 'login',
    EXPORT = 'export',
    CHANGE_PASSPHRASE = 'change-passphrase',
    LOGOUT = 'logout',
    ADD_ACCOUNT = 'add-account',
    RENAME = 'rename',
}

export interface SimpleResult {
    success: true;
}

export interface SignTransactionRequest {
    kind?: RequestType.SIGN_TRANSACTION;
    appName: string;
    walletId: string;
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

export interface SignTransactionResult {
    serializedTx: Uint8Array;

    sender: string;
    senderType: Nimiq.Account.Type;
    senderPubKey: Uint8Array;

    recipient: string;
    recipientType: Nimiq.Account.Type;

    value: number;
    fee: number;
    validityStartHeight: number;

    signature: Uint8Array;

    extraData: Uint8Array;
    flags: number;
    networkId: number;

    hash: string;
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
    walletId?: string;
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

export interface SignMessageResult {
    signer: string;
    signerPubKey: Uint8Array;
    signature: Uint8Array;
    data: Uint8Array;
}

export interface SignupRequest {
    kind?: RequestType.SIGNUP;
    appName: string;
}

export interface ParsedSignupRequest {
    kind: RequestType.SIGNUP;
    appName: string;
}

export interface SignupResult {
    walletId: string;
    label: string;
    type: WalletType;
    accounts: Array<{
        address: string;
        label: string;
    }>;
}

export interface LoginRequest {
    kind?: RequestType.LOGIN;
    appName: string;
}

export interface ParsedLoginRequest {
    kind: RequestType.LOGIN;
    appName: string;
}

export interface LoginResult {
    walletId: string;
    label: string;
    type: WalletType;
    accounts: Array<{
        address: string;
        label: string;
    }>;
}

export interface ExportRequest {
    kind?: RequestType.EXPORT;
    appName: string;
    walletId: string;
}

export interface ParsedExportRequest {
    kind: RequestType.EXPORT;
    appName: string;
    walletId: string;
}

export interface ChangePassphraseRequest {
    kind?: RequestType.CHANGE_PASSPHRASE;
    appName: string;
    walletId: string;
}

export interface ParsedChangePassphraseRequest {
    kind: RequestType.CHANGE_PASSPHRASE;
    appName: string;
    walletId: string;
}

export interface LogoutRequest {
    kind?: RequestType.LOGOUT;
    appName: string;
    walletId: string;
}

export interface ParsedLogoutRequest {
    kind: RequestType.LOGOUT;
    appName: string;
    walletId: string;
}

export interface LogoutResult {
    success: boolean;
}

export interface AddAccountRequest {
    kind?: RequestType.ADD_ACCOUNT;
    appName: string;
    walletId: string;
}

export interface ParsedAddAccountRequest {
    kind: RequestType.ADD_ACCOUNT;
    appName: string;
    walletId: string;
}

export interface AddAccountResult {
    walletId: string;
    account: {
        address: string;
        label: string;
    };
}

export interface RenameRequest {
    kind?: RequestType.RENAME;
    appName: string;
    walletId: string;
    address?: string;
}

export interface ParsedRenameRequest {
    kind: RequestType.RENAME;
    appName: string;
    walletId: string;
    address?: string;
}

export interface RenameResult {
    walletId: string;
    label: string;
    accounts: [{
        address: string;
        label: string;
    }];
}

export interface MigrateRequest {
    kind?: RequestType.MIGRATE;
}
export interface ParsedMigrateRequest {
    kind: RequestType.MIGRATE;
}

export type ListResult = WalletInfoEntry[];

// Discriminated Unions
export type RpcRequest = SignTransactionRequest
                       | CheckoutRequest
                       | SignupRequest
                       | LoginRequest
                       | ExportRequest
                       | ChangePassphraseRequest
                       | LogoutRequest
                       | AddAccountRequest
                       | RenameRequest
                       | SignMessageRequest
                       | MigrateRequest;
export type ParsedRpcRequest = ParsedSignTransactionRequest
                             | ParsedCheckoutRequest
                             | ParsedSignupRequest
                             | ParsedLoginRequest
                             | ParsedExportRequest
                             | ParsedChangePassphraseRequest
                             | ParsedLogoutRequest
                             | ParsedAddAccountRequest
                             | ParsedRenameRequest
                             | ParsedSignMessageRequest
                             | ParsedMigrateRequest;
export type RpcResult = SignTransactionResult
                      | SignupResult
                      | LoginResult
                      | SimpleResult
                      | LogoutResult
                      | AddAccountResult
                      | RenameResult
                      | SignMessageResult
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
                    walletId: request.walletId,
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
                if (request.shopLogoUrl && state.origin && new URL(request.shopLogoUrl).origin !== state.origin) {
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
            case RequestType.SIGNUP:
                request = request as SignupRequest;
                return {
                    kind: RequestType.SIGNUP,
                    appName: request.appName,
                } as ParsedSignupRequest;
            case RequestType.LOGIN:
                request = request as LoginRequest;
                return {
                    kind: RequestType.LOGIN,
                    appName: request.appName,
                } as ParsedLoginRequest;
            case RequestType.EXPORT:
                request = request as ExportRequest;
                return {
                    kind: RequestType.EXPORT,
                    appName: request.appName,
                    walletId: request.walletId,
                } as ParsedExportRequest;
            case RequestType.CHANGE_PASSPHRASE:
                request = request as ChangePassphraseRequest;
                return {
                    kind: RequestType.CHANGE_PASSPHRASE,
                    appName: request.appName,
                    walletId: request.walletId,
                } as ParsedChangePassphraseRequest;
            case RequestType.LOGOUT:
                request = request as LogoutRequest;
                return {
                    kind: RequestType.LOGOUT,
                    appName: request.appName,
                    walletId: request.walletId,
                } as ParsedLogoutRequest;
            case RequestType.ADD_ACCOUNT:
                request = request as AddAccountRequest;
                return {
                    kind: RequestType.ADD_ACCOUNT,
                    appName: request.appName,
                    walletId: request.walletId,
                } as ParsedAddAccountRequest;
            case RequestType.RENAME:
                request = request as RenameRequest;
                return {
                    kind: RequestType.RENAME,
                    appName: request.appName,
                    walletId: request.walletId,
                    address: request.address,
                } as ParsedRenameRequest;
            case RequestType.SIGN_MESSAGE:
                request = request as SignMessageRequest;
                return {
                    kind: RequestType.SIGN_MESSAGE,
                    appName: request.appName,
                    walletId: request.walletId,
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
                    walletId: request.walletId,
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
            case RequestType.SIGNUP:
                return {
                    kind: RequestType.SIGNUP,
                    appName: request.appName,
                } as SignupRequest;
            case RequestType.LOGIN:
                return {
                    kind: RequestType.LOGIN,
                    appName: request.appName,
                } as LoginRequest;
            case RequestType.EXPORT:
                return request as ExportRequest;
            case RequestType.CHANGE_PASSPHRASE:
                return request as ChangePassphraseRequest;
            case RequestType.LOGOUT:
                return request as LogoutRequest;
            case RequestType.ADD_ACCOUNT:
                return request as AddAccountRequest;
            case RequestType.RENAME:
                return request as RenameRequest;
            case RequestType.SIGN_MESSAGE:
                return {
                    kind: RequestType.SIGN_MESSAGE,
                    appName: request.appName,
                    walletId: request.walletId,
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
