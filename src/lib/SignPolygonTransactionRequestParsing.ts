import { RequestType } from '../../client/PublicRequestTypes';
import type {
    PolygonGaslessTransfer,
    PolygonHtlcSettlement,
    SignPolygonGaslessTransferRequest,
    SignPolygonHtlcSettlementRequest,
    SignPolygonTransactionRequest,
} from '../../client/PublicRequestTypes';
import type {
    ParsedSignPolygonGaslessTransferRequest,
    ParsedSignPolygonHtlcSettlementRequest,
    ParsedSignPolygonTransactionRequest,
} from './RequestTypes';

/**
 * Parsing of SIGN_POLYGON_TRANSACTION requests for gasless USDC/USDT0 transfers and HTLC redeems and refunds, and their
 * inverse mapping for the history state.
 *
 * Only the shape is checked here. The Keyguard validates the request against its own pins (contracts, relays, tokens)
 * and fee limit, and builds the typed data it signs itself. The Hub forwards only the known plain fields.
 *
 * This module is deliberately kept free of imports of the app graph (RpcApi, router, views), such that unit tests can
 * import it standalone.
 */

export function parseSignPolygonTransactionRequest(
    request: SignPolygonTransactionRequest,
): ParsedSignPolygonTransactionRequest {
    switch (request.operation) {
        case undefined:
        case 'transfer':
            return parseSignPolygonGaslessTransferRequest(request);
        case 'redeem':
        case 'refund':
            return parseSignPolygonHtlcSettlementRequest(request);
        default:
            throw new Error('Invalid operation');
    }
}

export function rawSignPolygonTransactionRequest(
    request: ParsedSignPolygonTransactionRequest,
): SignPolygonTransactionRequest {
    if (request.operation === 'transfer') return rawSignPolygonGaslessTransferRequest(request);
    return {
        appName: request.appName,
        operation: request.operation,
        request: request.request,
        token: request.token,
        amount: request.amount,
        senderLabel: request.senderLabel,
    };
}

export function parseSignPolygonGaslessTransferRequest(
    request: SignPolygonGaslessTransferRequest,
): ParsedSignPolygonGaslessTransferRequest {
    const transfer = parsePolygonGaslessTransfer(request.request, 'request');

    const tokenNonce = request.tokenNonce;
    if (typeof tokenNonce !== 'number' || !Number.isSafeInteger(tokenNonce) || tokenNonce < 0) {
        throw new Error('tokenNonce must be a non-negative integer');
    }

    let corrects: ParsedSignPolygonGaslessTransferRequest['corrects'];
    if (request.corrects !== undefined) {
        const { deadline } = request.corrects;
        if (typeof deadline !== 'string' || !/^\d+$/.test(deadline)) {
            throw new Error('corrects.deadline must be a decimal string');
        }
        corrects = {
            ...parsePolygonGaslessTransfer(request.corrects, 'corrects'),
            deadline,
        };
    }

    return {
        kind: RequestType.SIGN_POLYGON_TRANSACTION,
        appName: request.appName,
        operation: 'transfer',
        request: transfer,
        tokenNonce,
        corrects,
        recipientLabel: request.recipientLabel,
    };
}

function rawSignPolygonGaslessTransferRequest(
    request: ParsedSignPolygonGaslessTransferRequest,
): SignPolygonGaslessTransferRequest {
    return {
        appName: request.appName,
        request: request.request,
        tokenNonce: request.tokenNonce,
        corrects: request.corrects,
        recipientLabel: request.recipientLabel,
    };
}

export function parseSignPolygonHtlcSettlementRequest(
    request: SignPolygonHtlcSettlementRequest,
): ParsedSignPolygonHtlcSettlementRequest {
    const { token, amount } = request;
    if (typeof token !== 'string' || !isPolygonAddress(token)) throw new Error('token must be a Polygon address');
    if (typeof amount !== 'string' || !/^\d+$/.test(amount)) throw new Error('amount must be a decimal string');
    return {
        kind: RequestType.SIGN_POLYGON_TRANSACTION,
        appName: request.appName,
        operation: request.operation,
        request: parsePolygonHtlcSettlement(request.request, 'request'),
        token,
        amount,
        senderLabel: request.senderLabel,
    };
}

export function parsePolygonHtlcSettlement(settlement: unknown, name: string): PolygonHtlcSettlement {
    if (!settlement || typeof settlement !== 'object') throw new Error(`${name} must be an object`);
    const { from, id, target, fee, relay } = settlement as PolygonHtlcSettlement;
    for (const [field, value] of Object.entries({ from, target, relay })) {
        if (typeof value !== 'string' || !isPolygonAddress(value)) {
            throw new Error(`${name}.${field} must be a Polygon address`);
        }
    }
    if (typeof id !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(id)) throw new Error(`${name}.id must be 32 bytes hex`);
    if (typeof fee !== 'string' || !/^\d+$/.test(fee)) throw new Error(`${name}.fee must be a decimal string`);
    return { from, id, target, fee, relay };
}

function isPolygonAddress(value: string) {
    return /^0x[0-9a-fA-F]{40}$/.test(value);
}

function parsePolygonGaslessTransfer(transfer: unknown, name: string): PolygonGaslessTransfer {
    if (!transfer || typeof transfer !== 'object') throw new Error(`${name} must be an object`);
    const { token, from, to, amount, fee, relay, nonce } = transfer as PolygonGaslessTransfer;
    for (const [field, value] of Object.entries({ token, from, to, relay })) {
        if (typeof value !== 'string' || !isPolygonAddress(value)) {
            throw new Error(`${name}.${field} must be a Polygon address`);
        }
    }
    for (const [field, value] of Object.entries({ amount, fee, nonce })) {
        if (typeof value !== 'string' || !/^\d+$/.test(value)) {
            throw new Error(`${name}.${field} must be a decimal string`);
        }
    }
    return { token, from, to, amount, fee, relay, nonce };
}
