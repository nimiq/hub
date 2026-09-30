import { RequestType } from '../../client/PublicRequestTypes';
import type { PolygonGaslessTransfer, SignPolygonGaslessTransferRequest } from '../../client/PublicRequestTypes';
import type { ParsedSignPolygonGaslessTransferRequest } from './RequestTypes';

/**
 * Parsing of SIGN_POLYGON_TRANSACTION requests for gasless USDC/USDT0 transfers and their inverse mapping for the
 * history state. Requests relayed via OpenGSN (swaps) are passed through by the RequestParser, as before.
 *
 * Only the shape is checked here. The Keyguard validates the transfer against its own pins (contract, relays, tokens)
 * and fee limit, and builds the typed data it signs itself. The Hub forwards only the known plain fields.
 *
 * This module is deliberately kept free of imports of the app graph (RpcApi, router, views), such that unit tests can
 * import it standalone.
 */

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
        const { nonce, deadline } = request.corrects;
        if (typeof nonce !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(nonce)) {
            throw new Error('corrects.nonce must be a bytes32 hex string');
        }
        if (typeof deadline !== 'string' || !/^\d+$/.test(deadline)) {
            throw new Error('corrects.deadline must be a decimal string');
        }
        corrects = {
            ...parsePolygonGaslessTransfer(request.corrects, 'corrects'),
            nonce,
            deadline,
        };
    }

    return {
        kind: RequestType.SIGN_POLYGON_TRANSACTION,
        appName: request.appName,
        request: transfer,
        tokenNonce,
        corrects,
        recipientLabel: request.recipientLabel,
    };
}

export function rawSignPolygonGaslessTransferRequest(
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

function parsePolygonGaslessTransfer(transfer: unknown, name: string): PolygonGaslessTransfer {
    if (!transfer || typeof transfer !== 'object') throw new Error(`${name} must be an object`);
    const { token, from, to, amount, fee, relay } = transfer as PolygonGaslessTransfer;
    for (const [field, value] of Object.entries({ token, from, to, relay })) {
        if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(value)) {
            throw new Error(`${name}.${field} must be a Polygon address`);
        }
    }
    for (const [field, value] of Object.entries({ amount, fee })) {
        if (typeof value !== 'string' || !/^\d+$/.test(value)) {
            throw new Error(`${name}.${field} must be a decimal string`);
        }
    }
    return { token, from, to, amount, fee, relay };
}
