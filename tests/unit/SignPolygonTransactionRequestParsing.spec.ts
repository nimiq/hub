import { setup } from './_setup';
import {
    parseSignPolygonTransactionRequest,
    rawSignPolygonTransactionRequest,
} from '@/lib/SignPolygonTransactionRequestParsing';
import type {
    ParsedSignPolygonGaslessTransferRequest,
    ParsedSignPolygonHtlcSettlementRequest,
} from '@/lib/RequestTypes';
import { RequestType } from '../../client/PublicRequestTypes';
import type {
    SignPolygonGaslessTransferRequest,
    SignPolygonHtlcSettlementRequest,
} from '../../client/PublicRequestTypes';

setup();

// The Keyguard validates gasless requests against its own pins and fee limit. The Hub only checks the shape and
// forwards the plain fields, never typed data or calldata.

const TRANSFER = {
    token: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    from: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    to: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    amount: '10000000',
    fee: '10000',
    relay: '0xBcd4042DE499D14e55001CcbB24a551F3b954096',
    nonce: '3',
};

const SETTLEMENT = {
    from: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    id: `0x${'11'.repeat(32)}`,
    target: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    fee: '10000',
    relay: '0xBcd4042DE499D14e55001CcbB24a551F3b954096',
};

function parse(request: Partial<SignPolygonGaslessTransferRequest> & Record<string, unknown>) {
    return parseSignPolygonTransactionRequest(
        { appName: 'Test App', request: TRANSFER, tokenNonce: 0, ...request } as SignPolygonGaslessTransferRequest,
    ) as ParsedSignPolygonGaslessTransferRequest;
}

function parseSettlement(request: Partial<SignPolygonHtlcSettlementRequest> & Record<string, unknown>) {
    return parseSignPolygonTransactionRequest({
        appName: 'Test App',
        operation: 'redeem',
        request: SETTLEMENT,
        token: TRANSFER.token,
        amount: '9990000',
        ...request,
    } as SignPolygonHtlcSettlementRequest) as ParsedSignPolygonHtlcSettlementRequest;
}

describe('SIGN_POLYGON_TRANSACTION gasless transfer request parsing', () => {
    it('keeps only the gasless transfer fields', () => {
        const parsed = parse({
            recipientLabel: 'Alice',
            // Fields of the former OpenGSN request or unknown fields must not be forwarded to the Keyguard
            relayData: { forwarder: '0x0000000000000000000000000000000000000001' },
        } as any);
        expect(parsed.kind).toBe(RequestType.SIGN_POLYGON_TRANSACTION);
        expect(parsed.operation).toBe('transfer');
        expect(parsed.request).toEqual(TRANSFER);
        expect(parsed.tokenNonce).toBe(0);
        expect(parsed.corrects).toBeUndefined();
        expect(parsed.recipientLabel).toBe('Alice');
        expect('relayData' in parsed).toBe(false);

        const raw = rawSignPolygonTransactionRequest(parsed);
        expect(parse(raw as any)).toEqual(parsed);
        expect(parse({ operation: 'transfer' })).toEqual(parse({}));
    });

    it('parses a correction of an earlier version', () => {
        const corrects = {
            ...TRANSFER,
            fee: '5000',
            deadline: '1790000600',
        };
        expect(parse({ corrects }).corrects).toEqual(corrects);
        expect(() => parse({ corrects: { ...corrects, nonce: `0x${'ab'.repeat(32)}` } })).toThrow();
        expect(() => parse({ corrects: { ...corrects, deadline: 1790000600 as any } })).toThrow();
    });

    it('rejects malformed transfers', () => {
        expect(() => parse({ request: undefined })).toThrow();
        expect(() => parse({ request: { ...TRANSFER, to: 'NQ07 0000' } })).toThrow();
        expect(() => parse({ request: { ...TRANSFER, amount: 10000000 as any } })).toThrow();
        expect(() => parse({ request: { ...TRANSFER, fee: '-1' } })).toThrow();
        expect(() => parse({ request: { ...TRANSFER, nonce: undefined as any } })).toThrow();
        expect(() => parse({ request: { ...TRANSFER, nonce: 3 as any } })).toThrow();
        expect(() => parse({ tokenNonce: -1 })).toThrow();
        expect(() => parse({ tokenNonce: '0' as any })).toThrow();
    });
});

describe('SIGN_POLYGON_TRANSACTION HTLC settlement request parsing', () => {
    it('keeps only the HTLC settlement fields', () => {
        const parsed = parseSettlement({
            senderLabel: 'Swap HTLC',
            relayData: { forwarder: '0x0000000000000000000000000000000000000001' },
            request: { ...SETTLEMENT, secret: `0x${'22'.repeat(32)}` } as any,
        } as any);
        expect(parsed.kind).toBe(RequestType.SIGN_POLYGON_TRANSACTION);
        expect(parsed.operation).toBe('redeem');
        expect(parsed.request).toEqual(SETTLEMENT);
        expect(parsed.token).toBe(TRANSFER.token);
        expect(parsed.amount).toBe('9990000');
        expect(parsed.senderLabel).toBe('Swap HTLC');
        expect('relayData' in parsed).toBe(false);

        const raw = rawSignPolygonTransactionRequest(parsed);
        expect(parseSettlement(raw as any)).toEqual(parsed);
        expect(parseSettlement({ operation: 'refund' }).operation).toBe('refund');
    });

    it('rejects malformed settlements and unknown operations', () => {
        expect(() => parseSettlement({ operation: 'open' as any })).toThrow();
        expect(() => parseSettlement({ request: { ...SETTLEMENT, id: '0x11' } })).toThrow();
        expect(() => parseSettlement({ request: { ...SETTLEMENT, target: undefined as any } })).toThrow();
        expect(() => parseSettlement({ request: { ...SETTLEMENT, fee: 10000 as any } })).toThrow();
        expect(() => parseSettlement({ token: 'USDC' })).toThrow();
        expect(() => parseSettlement({ amount: 9990000 as any })).toThrow();
    });
});
