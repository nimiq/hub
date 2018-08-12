export enum RequestType {
    CHECKOUT = 'checkout',
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

// Discriminated Unions
export type RpcRequest = CheckoutRequest;
export type ParsedRpcRequest = ParsedCheckoutRequest;

export class AccountsRequest {
    public static parse(request: RpcRequest, requestType?: RequestType): ParsedRpcRequest | null {
        switch (request.kind || requestType) {
            case RequestType.CHECKOUT:
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
                };
            default:
                return null;
        }
    }

    public static raw(request: ParsedRpcRequest): RpcRequest {
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
                };
        }
    }
}
