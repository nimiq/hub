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

export interface BasicRequest {
    appName: string;
}

export interface ParsedBasicRequest<T extends RequestType> {
    kind: T;
    appName: string;
}

export interface SimpleRequest extends BasicRequest {
    accountId: string;
}

export interface ParsedSimpleRequest<T extends RequestType> extends ParsedBasicRequest<T> {
    walletId: string;
}

export interface SimpleResult {
    success: true;
}

export interface SignTransactionRequest extends SimpleRequest {
    sender: string;
    recipient: string;
    recipientType?: Nimiq.Account.Type;
    value: number;
    fee?: number;
    extraData?: Uint8Array;
    flags?: number;
    validityStartHeight: number; // FIXME To be made optional when accounts manager has its own network
}

export interface ParsedSignTransactionRequest extends ParsedSimpleRequest<RequestType.SIGN_TRANSACTION> {
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

export interface CheckoutRequest extends BasicRequest {
    shopLogoUrl?: string;
    recipient: string;
    recipientType?: Nimiq.Account.Type;
    value: number;
    fee?: number;
    extraData?: Uint8Array;
    flags?: number;
    validityDuration?: number;
}

export interface ParsedCheckoutRequest extends ParsedBasicRequest<RequestType.CHECKOUT> {
    shopLogoUrl?: string;
    recipient: Nimiq.Address;
    recipientType?: Nimiq.Account.Type;
    value: number;
    fee?: number;
    data?: Uint8Array;
    flags?: number;
    validityDuration: number;
}

export interface SignMessageRequest extends BasicRequest {
    accountId?: string;
    signer?: string;
    message: string | Uint8Array;
}

export interface ParsedSignMessageRequest extends ParsedBasicRequest<RequestType.SIGN_MESSAGE> {
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

export interface ParsedOnboardingRequest extends ParsedBasicRequest<RequestType.ONBOARD> { }

export interface ParsedChooseAddressRequest extends ParsedBasicRequest<RequestType.CHOOSE_ADDRESS> { }

export interface ParsedSignupRequest extends ParsedBasicRequest<RequestType.SIGNUP> { }

export interface ParsedLoginRequest extends ParsedBasicRequest<RequestType.LOGIN> { }

export interface Address {
    address: string; // Userfriendly address
    label: string;
}

export interface Account {
    accountId: string;
    label: string;
    type: WalletType;
    addresses: Address[];
}

export interface ParsedExportRequest extends ParsedSimpleRequest<RequestType.EXPORT> { }

export interface ParsedChangePasswordRequest extends ParsedSimpleRequest<RequestType.CHANGE_PASSWORD> { }

export interface ParsedLogoutRequest extends ParsedSimpleRequest<RequestType.LOGOUT> { }

export interface ParsedAddAccountRequest extends ParsedSimpleRequest<RequestType.ADD_ADDRESS> { }

export interface RenameRequest extends SimpleRequest {
    address?: string;
}

export interface ParsedRenameRequest extends ParsedSimpleRequest<RequestType.RENAME> {
    address?: string;
}

export interface ParsedMigrateRequest extends ParsedBasicRequest<RequestType.MIGRATE> { }

export type ListResult = WalletInfoEntry[];

// Discriminated Unions
export type RpcRequest = SignTransactionRequest
                       | CheckoutRequest
                       | BasicRequest
                       | SimpleRequest
                       | RenameRequest
                       | SignMessageRequest;

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
                      | ListResult;

export class AccountsRequest {
    public static parse(request: RpcRequest, state: State, requestType?: RequestType): ParsedRpcRequest | null {
        switch (requestType) {
            case RequestType.SIGN_TRANSACTION:
                const signTransactionRequest = request as SignTransactionRequest;
                return {
                    kind: RequestType.SIGN_TRANSACTION,
                    appName: signTransactionRequest.appName,
                    walletId: signTransactionRequest.accountId,
                    sender: Nimiq.Address.fromUserFriendlyAddress(signTransactionRequest.sender),
                    recipient: Nimiq.Address.fromUserFriendlyAddress(signTransactionRequest.recipient),
                    recipientType: signTransactionRequest.recipientType,
                    value: signTransactionRequest.value,
                    fee: signTransactionRequest.fee,
                    data: signTransactionRequest.extraData,
                    flags: signTransactionRequest.flags,
                    validityStartHeight: signTransactionRequest.validityStartHeight,
                } as ParsedSignTransactionRequest;
            case RequestType.CHECKOUT:
                const checkoutRequest = request as CheckoutRequest;
                if (checkoutRequest.shopLogoUrl && new URL(checkoutRequest.shopLogoUrl).origin !== state.origin) {
                    throw new Error(
                        'shopLogoUrl must have same origin as caller website. Image at ' +
                        checkoutRequest.shopLogoUrl +
                        ' is not on caller origin ' +
                        state.origin);
                }
                return {
                    kind: RequestType.CHECKOUT,
                    appName: checkoutRequest.appName,
                    shopLogoUrl: checkoutRequest.shopLogoUrl,
                    recipient: Nimiq.Address.fromUserFriendlyAddress(checkoutRequest.recipient),
                    recipientType: checkoutRequest.recipientType,
                    value: checkoutRequest.value,
                    fee: checkoutRequest.fee,
                    data: checkoutRequest.extraData,
                    flags: checkoutRequest.flags,
                    validityDuration: !checkoutRequest.validityDuration ? TX_VALIDITY_WINDOW : Math.min(
                        TX_VALIDITY_WINDOW,
                        Math.max(
                            TX_MIN_VALIDITY_DURATION,
                            checkoutRequest.validityDuration,
                        ),
                    ),
                } as ParsedCheckoutRequest;
            case RequestType.ONBOARD:
                return {
                    kind: RequestType.ONBOARD,
                    appName: request.appName,
                } as ParsedBasicRequest<RequestType.ONBOARD>;
            case RequestType.SIGNUP:
                return {
                    kind: RequestType.SIGNUP,
                    appName: request.appName,
                } as ParsedBasicRequest<RequestType.SIGNUP>;
            case RequestType.CHOOSE_ADDRESS:
                return {
                    kind: RequestType.CHOOSE_ADDRESS,
                    appName: request.appName,
                } as ParsedBasicRequest<RequestType.CHOOSE_ADDRESS>;
            case RequestType.LOGIN:
                return {
                    kind: RequestType.LOGIN,
                    appName: request.appName,
                } as ParsedBasicRequest<RequestType.LOGIN>;
            case RequestType.MIGRATE:
                return {
                    kind: RequestType.MIGRATE,
                    appName: request.appName,
                } as ParsedBasicRequest<RequestType.MIGRATE>;
            case RequestType.EXPORT:
                const exportRequest = request as SimpleRequest;
                return {
                    kind: RequestType.EXPORT,
                    appName: exportRequest.appName,
                    walletId: exportRequest.accountId,
                } as ParsedSimpleRequest<RequestType.EXPORT>;
            case RequestType.CHANGE_PASSWORD:
                const changePasswordRequest = request as SimpleRequest;
                return {
                    kind: RequestType.CHANGE_PASSWORD,
                    appName: changePasswordRequest.appName,
                    walletId: changePasswordRequest.accountId,
                } as ParsedSimpleRequest<RequestType.CHANGE_PASSWORD>;
            case RequestType.LOGOUT:
                const logoutRequest = request as SimpleRequest;
                return {
                    kind: RequestType.LOGOUT,
                    appName: logoutRequest.appName,
                    walletId: logoutRequest.accountId,
                } as ParsedSimpleRequest<RequestType.LOGOUT>;
            case RequestType.ADD_ADDRESS:
                const addAddressRequest = request as SimpleRequest;
                return {
                    kind: RequestType.ADD_ADDRESS,
                    appName: addAddressRequest.appName,
                    walletId: addAddressRequest.accountId,
                } as ParsedSimpleRequest<RequestType.ADD_ADDRESS>;
            case RequestType.RENAME:
                const renameRequest = request as RenameRequest;
                return {
                    kind: RequestType.RENAME,
                    appName: renameRequest.appName,
                    walletId: renameRequest.accountId,
                    address: renameRequest.address,
                } as ParsedRenameRequest;
            case RequestType.SIGN_MESSAGE:
                const signMessageRequest = request as SignMessageRequest;
                if (typeof signMessageRequest.message !== 'string'
                    && !(signMessageRequest.message instanceof Uint8Array)) {
                    throw new Error('message must be a string or Uint8Array');
                }
                return {
                    kind: RequestType.SIGN_MESSAGE,
                    appName: signMessageRequest.appName,
                    walletId: signMessageRequest.accountId,
                    signer: signMessageRequest.signer
                            ? Nimiq.Address.fromUserFriendlyAddress(signMessageRequest.signer)
                            : undefined,
                    message: signMessageRequest.message,
                } as ParsedSignMessageRequest;
            default:
                return null;
        }
    }

    public static raw(request: ParsedRpcRequest): RpcRequest | null {
        switch (request.kind) {
            case RequestType.SIGN_TRANSACTION:
                return {
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
            case RequestType.MIGRATE:
            case RequestType.ONBOARD:
            case RequestType.SIGNUP:
            case RequestType.CHOOSE_ADDRESS:
            case RequestType.LOGIN:
                return {
                    appName: request.appName,
                } as BasicRequest;
            case RequestType.EXPORT:
            case RequestType.CHANGE_PASSWORD:
            case RequestType.LOGOUT:
            case RequestType.ADD_ADDRESS:
                return {
                    appName: request.appName,
                    accountId: request.walletId,
                } as SimpleRequest;
            case RequestType.RENAME:
                return {
                    appName: request.appName,
                    accountId: request.walletId,
                    address: request.address,
                } as RenameRequest;
            case RequestType.SIGN_MESSAGE:
                return {
                    appName: request.appName,
                    accountId: request.walletId,
                    signer: request.signer ? request.signer.toUserFriendlyAddress() : undefined,
                    message: request.message,
                } as SignMessageRequest;
            default:
                return null;
        }
    }
}
