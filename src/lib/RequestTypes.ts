export enum RequestType {
    LIST = 'list',
    CHECKOUT = 'checkout',
    SIGNTRANSACTION = 'sign-transaction',
    SIGNUP = 'signup',
    LOGIN = 'login',
}

export interface SignTransactionRequest {
    kind?: RequestType.SIGNTRANSACTION;
    appName: string;
    keyId: string;
    sender: string;
    recipient: string;
    recipientType?: Nimiq.Account.Type;
    value: number;
    fee?: number;
    extraData?: Uint8Array;
    flags?: number;
    networkId?: number;
    validityStartHeight: number; // FIXME To be made optional when accounts manager has its own network
}

export interface ParsedSignTransactionRequest {
    kind: RequestType.SIGNTRANSACTION;
    appName: string;
    keyId: string;
    sender: Nimiq.Address;
    recipient: Nimiq.Address;
    recipientType?: Nimiq.Account.Type;
    value: number;
    fee?: number;
    data?: Uint8Array;
    flags?: number;
    networkId?: number;
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
    recipient: string;
    recipientType?: Nimiq.Account.Type;
    value: number;
    fee?: number;
    extraData?: Uint8Array;
    flags?: number;
    networkId?: number;
}

export interface ParsedCheckoutRequest {
    kind: RequestType.CHECKOUT;
    appName: string;
    recipient: Nimiq.Address;
    recipientType?: Nimiq.Account.Type;
    value: number;
    fee?: number;
    data?: Uint8Array;
    flags?: number;
    networkId?: number;
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
    address: string;
    label: string;
    keyId: string;
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
    addresses: Array<{address: Uint8Array, label: string}>;
}

// Discriminated Unions
export type RpcRequest = SignTransactionRequest
                       | CheckoutRequest
                       | SignupRequest
                       | LoginRequest;
export type ParsedRpcRequest = ParsedSignTransactionRequest
                             | ParsedCheckoutRequest
                             | ParsedSignupRequest
                             | ParsedLoginRequest;

export class AccountsRequest {
    public static parse(request: RpcRequest, requestType?: RequestType): ParsedRpcRequest | null {
        switch (request.kind || requestType) {
            case RequestType.SIGNTRANSACTION:
                // Because the switch statement is not definitely using 'request.kind' as the condition,
                // Typescript cannot infer what type the request variable is from the control flow,
                // thus we need to force-cast it here:
                request = request as SignTransactionRequest;
                return {
                    kind: RequestType.SIGNTRANSACTION,
                    appName: request.appName,
                    keyId: request.keyId,
                    sender: Nimiq.Address.fromUserFriendlyAddress(request.sender),
                    recipient: Nimiq.Address.fromUserFriendlyAddress(request.recipient),
                    recipientType: request.recipientType,
                    value: request.value,
                    fee: request.fee,
                    data: request.extraData,
                    flags: request.flags,
                    networkId: request.networkId,
                    validityStartHeight: request.validityStartHeight,
                } as ParsedSignTransactionRequest;
            case RequestType.CHECKOUT:
                // Because the switch statement is not definitely using 'request.kind' as the condition,
                // Typescript cannot infer what type the request variable is from the control flow,
                // thus we need to force-cast it here:
                request = request as CheckoutRequest;
                return {
                    kind: RequestType.CHECKOUT,
                    appName: request.appName,
                    recipient: Nimiq.Address.fromUserFriendlyAddress(request.recipient),
                    recipientType: request.recipientType,
                    value: request.value,
                    fee: request.fee,
                    data: request.extraData,
                    flags: request.flags,
                    networkId: request.networkId,
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
            default:
                return null;
        }
    }

    public static raw(request: ParsedRpcRequest): RpcRequest | null {
        switch (request.kind) {
            case RequestType.SIGNTRANSACTION:
                return {
                    kind: RequestType.SIGNTRANSACTION,
                    appName: request.appName,
                    keyId: request.keyId,
                    sender: request.sender.toUserFriendlyAddress(),
                    recipient: request.recipient.toUserFriendlyAddress(),
                    recipientType: request.recipientType,
                    value: request.value,
                    fee: request.fee,
                    extraData: request.data,
                    flags: request.flags,
                    networkId: request.networkId,
                    validityStartHeight: request.validityStartHeight,
                } as SignTransactionRequest;
            case RequestType.CHECKOUT:
                return {
                    kind: RequestType.CHECKOUT,
                    appName: request.appName,
                    recipient: request.recipient.toUserFriendlyAddress(),
                    recipientType: request.recipientType,
                    value: request.value,
                    fee: request.fee,
                    extraData: request.data,
                    flags: request.flags,
                    networkId: request.networkId,
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
            default:
                return null;
        }
    }
}
