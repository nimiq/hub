export enum RequestType {
    CHECKOUT
}

export interface CheckoutRequest {
    kind: RequestType.CHECKOUT
    recipient: Uint8Array
    recipientType?: Nimiq.Account.Type
    value: number
    fee?: number
    data?: Uint8Array
    flags?: number
    networkId?: number
}

export interface ParsedCheckoutRequest {
    kind: RequestType.CHECKOUT
    recipient: Nimiq.Address
    recipientType?: Nimiq.Account.Type
    value: number
    fee?: number
    data?: Uint8Array
    flags?: number
    networkId?: number
}

export type CheckoutResult = {
    serializedTx: Uint8Array,
    txHash: Uint8Array,

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
        proof: Uint8Array
    }
}

// Discriminated Unions
export type RpcRequest = CheckoutRequest;
export type ParsedRpcRequest = ParsedCheckoutRequest;
