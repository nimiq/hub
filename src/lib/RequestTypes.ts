export enum RequestType {
    CHECKOUT = 'checkout',
    CREATE = 'create',
}

export interface CheckoutRequest {
    kind?: RequestType.CHECKOUT;
    appName: string;
    recipient: Uint8Array;
    recipientType?: Nimiq.Account.Type;
    value: number;
    fee?: number;
    data?: Uint8Array;
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

export interface CheckoutResult {
    serializedTx: Uint8Array;
    txHash: Uint8Array;

    tx: {
        sender: Uint8Array
        senderType: Nimiq.Account.Type
        recipient: Uint8Array
        recipientType: Nimiq.Account.Type
        value: number
        fee: number
        validityStartHeight: number
        data: Uint8Array
        flags: number
        networkId: number,
        proof: Uint8Array,
    };
}

export interface CreateRequest {
    kind?: RequestType.CREATE;
    appName: string;
}

export interface ParsedCreateRequest {
    kind: RequestType.CREATE;
    appName: string;
}

export interface CreateResult {
    address: Uint8Array;
    label: string;
}

// Discriminated Unions
export type RpcRequest = CheckoutRequest | CreateRequest;
export type ParsedRpcRequest = ParsedCheckoutRequest | ParsedCreateRequest;

export class AccountsRequest {
    public static parse(request: RpcRequest, requestType?: RequestType): ParsedRpcRequest | null {
        switch (request.kind || requestType) {
            case RequestType.CHECKOUT:
                // Because the switch statement is not definitely using 'request.kind' as the condition,
                // Typescript cannot infer what type the request variable is from the control flow,
                // thus we need to force-cast it here:
                request = request as CheckoutRequest;
                return {
                    kind: RequestType.CHECKOUT,
                    appName: request.appName,
                    recipient: new Nimiq.Address(request.recipient),
                    recipientType: request.recipientType,
                    value: request.value,
                    fee: request.fee,
                    data: request.data,
                    flags: request.flags,
                    networkId: request.networkId,
                } as ParsedCheckoutRequest;
            case RequestType.CREATE:
                request = request as CreateRequest;
                return {
                    kind: RequestType.CREATE,
                    appName: request.appName,
                } as ParsedCreateRequest;
            default:
                return null;
        }
    }

    public static raw(request: ParsedRpcRequest): RpcRequest | null {
        switch (request.kind) {
            case RequestType.CHECKOUT:
                return {
                    kind: RequestType.CHECKOUT,
                    appName: request.appName,
                    recipient: request.recipient.serialize(),
                    recipientType: request.recipientType,
                    value: request.value,
                    fee: request.fee,
                    data: request.data,
                    flags: request.flags,
                    networkId: request.networkId,
                } as CheckoutRequest;
            case RequestType.CREATE:
                return {
                    kind: RequestType.CREATE,
                    appName: request.appName,
                } as CreateRequest;
            default:
                return null;
        }
    }
}
