export enum KeyguardCommand {
    CREATE = 'create',
    REMOVE = 'remove-key',
    IMPORT_WORDS = 'import-words',
    IMPORT_FILE = 'import-file',
    EXPORT_WORDS = 'export-words',
    EXPORT_FILE = 'export-file',
    SIGN_TRANSACTION = 'sign-transaction',
    SIGN_MESSAGE = 'sign-message',
}

export interface SignTransactionRequest {
    layout?: 'standard' | 'checkout' | 'cashlink';
    shopOrigin?: string;
    appName: string;

    keyId: string;
    keyPath: string;
    keyLabel?: string;

    sender: Uint8Array;
    senderType?: Nimiq.Account.Type;
    senderLabel?: string;
    recipient: Uint8Array;
    recipientType?: Nimiq.Account.Type;
    recipientLabel?: string;
    value: number;
    fee: number;
    validityStartHeight: number;
    data?: Uint8Array;
    flags?: number;
    networkId?: number;
}

export interface SignTransactionResult {
    kind?: KeyguardCommand.SIGN_TRANSACTION;
    publicKey: Uint8Array;
    signature: Uint8Array;
}

export interface SignMessageRequest {
    keyId: string;
    keyPath: string;
    keyLabel?: string;

    message: string;
}

export interface SignMessageResult {
    kind?: KeyguardCommand.SIGN_MESSAGE;
    message: string;
    publicKey: string;
    signature: string;
}

export type RpcResult = SignTransactionResult | SignMessageResult;
