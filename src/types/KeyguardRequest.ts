import TransactionType from './TransactionType';
import EncryptionType from './EncryptionType';
import Nimiq from '../../Nimiq';

export interface BasicTransactionRequest {
    type: TransactionType.BASIC;
    sender: string;
    recipient: string;
    signer: string;
    value: number;
    fee: number;
    network: string;
    validityStartHeight: number;
}

export interface SignedTransactionResult {
    sender: string;
    senderPubKey: Nimiq.SerialBuffer;
    recipient: string;
    value: number;
    fee: number;
    validityStartHeight: number;
    signature: Nimiq.SerialBuffer;
    extraData: string;
    hash: string;
}

export type ExtendedTransactionRequest = BasicTransactionRequest & {
    type: TransactionType.EXTENDED,
    extraData: string,
};

export type TransactionRequest = BasicTransactionRequest | ExtendedTransactionRequest;

export interface CreateRequest {
    type: EncryptionType;
}

export interface MessageRequest {
    message: string | Uint8Array;
    signer: string;
}

export type KeyguardRequest = TransactionRequest | CreateRequest | MessageRequest;
