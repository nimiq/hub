import { Utf8Tools } from '@nimiq/utils';
import type KeyguardClient from '@nimiq/keyguard-client';
import { RequestType } from '../../client/PublicRequestTypes';
import type {
    Bytes,
    CreateMultisigCommitmentsRequest,
    MultisigTransactionInfo,
    SignMultisigTransactionRequest,
} from '../../client/PublicRequestTypes';
import type {
    ParsedCreateMultisigCommitmentsRequest,
    ParsedMultisigTransactionInfo,
    ParsedSignMultisigTransactionRequest,
} from './RequestTypes';

/**
 * Parsing of the two rounds of signing a multisig transaction, CREATE_MULTISIG_COMMITMENTS and
 * SIGN_MULTISIG_TRANSACTION, and their inverse mapping for the history state.
 *
 * Most fields are validated by the Keyguard, the Hub mostly converts types. The Keyguard requires the transaction of
 * both rounds to be identical, which is why both rounds share the transaction parsing here and the forwarding in
 * keyguardMultisigTransactionInfo.
 *
 * This module is deliberately kept free of imports of the app graph (RpcApi, router, views), such that unit tests can
 * import it standalone.
 */

export function parseCreateMultisigCommitmentsRequest(
    request: CreateMultisigCommitmentsRequest,
): ParsedCreateMultisigCommitmentsRequest {
    const multisigConfig = parseObject(request.multisigConfig, 'multisigConfig');
    const { numberOfSigners } = multisigConfig;
    if (typeof numberOfSigners !== 'number' || !Number.isSafeInteger(numberOfSigners) || numberOfSigners <= 0) {
        throw new Error('multisigConfig.numberOfSigners must be a positive integer');
    }

    return {
        kind: RequestType.CREATE_MULTISIG_COMMITMENTS,
        appName: request.appName,
        ...parseMultisigTransactionInfo(request),
        senderLabel: request.senderLabel,

        multisigConfig: {
            publicKeys: parseBytesArray(multisigConfig.publicKeys, 'multisigConfig.publicKeys'),
            numberOfSigners,
            userName: request.multisigConfig.userName,
        },
    };
}

export function rawCreateMultisigCommitmentsRequest(
    request: ParsedCreateMultisigCommitmentsRequest,
): CreateMultisigCommitmentsRequest {
    return {
        appName: request.appName,
        ...rawMultisigTransactionInfo(request),
        senderLabel: request.senderLabel,
        multisigConfig: request.multisigConfig,
    };
}

export function parseSignMultisigTransactionRequest(
    request: SignMultisigTransactionRequest,
): ParsedSignMultisigTransactionRequest {
    const multisigConfig = parseObject(request.multisigConfig, 'multisigConfig');
    if ('secrets' in multisigConfig) {
        // The Keyguard derives the commitment secrets itself since nimiq/keyguard#579.
        throw new Error('multisigConfig.secrets are not supported anymore, '
            + 'pass the state returned by createMultisigCommitments instead');
    }
    if (!Array.isArray(multisigConfig.signers)) throw new Error('multisigConfig.signers must be an array');

    return {
        kind: RequestType.SIGN_MULTISIG_TRANSACTION,
        appName: request.appName,
        ...parseMultisigTransactionInfo(request),
        senderLabel: request.senderLabel,

        multisigConfig: {
            publicKeys: parseBytesArray(multisigConfig.publicKeys, 'multisigConfig.publicKeys'),
            signers: request.multisigConfig.signers.map((signer, i) => {
                const { publicKey, commitments } = parseObject(signer, `multisigConfig.signers[${i}]`);
                return {
                    publicKey: parseBytes(publicKey, `multisigConfig.signers[${i}].publicKey`),
                    commitments: parseBytesArray(commitments, `multisigConfig.signers[${i}].commitments`),
                };
            }),
            state: parseBytes(multisigConfig.state, 'multisigConfig.state'),
            userName: request.multisigConfig.userName,
        },
    };
}

export function rawSignMultisigTransactionRequest(
    request: ParsedSignMultisigTransactionRequest,
): SignMultisigTransactionRequest {
    return {
        appName: request.appName,
        ...rawMultisigTransactionInfo(request),
        senderLabel: request.senderLabel,
        multisigConfig: request.multisigConfig,
    };
}

/**
 * The transaction fields of the Keyguard's create-multisig-commitments and sign-multisig-transaction requests, which
 * must be identical in both rounds.
 */
export function keyguardMultisigTransactionInfo(
    request: ParsedMultisigTransactionInfo,
): Omit<KeyguardClient.TransactionInfo, 'senderLabel'> & { recipientLabel?: string } {
    return {
        sender: request.sender.serialize(),
        senderType: request.senderType,
        senderData: request.senderData,
        recipient: request.recipient.serialize(),
        recipientType: request.recipientType,
        recipientLabel: request.recipientLabel,
        value: request.value,
        fee: request.fee,
        validityStartHeight: request.validityStartHeight,
        recipientData: request.data,
        flags: request.flags,
    };
}

function parseMultisigTransactionInfo(
    request: MultisigTransactionInfo & { signer: string },
): ParsedMultisigTransactionInfo {
    return {
        signer: Nimiq.Address.fromAny(request.signer),

        sender: Nimiq.Address.fromString(request.sender),
        senderType: request.senderType || Nimiq.AccountType.Basic,
        senderData: parseMessage(request.senderData),
        recipient: Nimiq.Address.fromString(request.recipient),
        recipientType: request.recipientType || Nimiq.AccountType.Basic,
        recipientLabel: request.recipientLabel,
        value: request.value,
        fee: request.fee || 0,
        data: parseMessage(request.extraData) || new Uint8Array(0),
        flags: request.flags || Nimiq.TransactionFlag.None,
        validityStartHeight: request.validityStartHeight,
    };
}

function rawMultisigTransactionInfo(
    request: ParsedMultisigTransactionInfo,
): MultisigTransactionInfo & { signer: string } {
    return {
        signer: request.signer.toUserFriendlyAddress(),

        sender: request.sender.toUserFriendlyAddress(),
        senderType: request.senderType,
        senderData: request.senderData,
        recipient: request.recipient.toUserFriendlyAddress(),
        recipientType: request.recipientType,
        recipientLabel: request.recipientLabel,
        value: request.value,
        fee: request.fee,
        extraData: request.data,
        flags: request.flags,
        validityStartHeight: request.validityStartHeight,
    };
}

function parseObject(object: unknown, name: string): Record<string, unknown> {
    if (!object || typeof object !== 'object') throw new Error(`${name} must be an object`);
    return object as Record<string, unknown>;
}

function parseMessage(msg?: Bytes): Uint8Array | undefined {
    if (!msg) return undefined;
    if (msg instanceof Uint8Array) return msg;
    if (typeof msg === 'string') return Utf8Tools.stringToUtf8ByteArray(msg);
    throw new Error('extraData must be a string or an Uint8Array');
}

function parseBytes(bytes: unknown, name: string): Uint8Array {
    if (bytes instanceof Uint8Array && bytes.length) return bytes;
    if (typeof bytes === 'string' && bytes.length) return Nimiq.BufferUtils.fromAny(bytes);
    throw new Error(`${name} must be a non-empty string or Uint8Array`);
}

function parseBytesArray(array: unknown, name: string): Uint8Array[] {
    if (!Array.isArray(array)) throw new Error(`${name} must be an array`);
    return array.map((bytes, i) => parseBytes(bytes, `${name}[${i}]`));
}
