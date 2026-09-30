import { setup } from './_setup';
import {
    parseSignPolygonTransactionRequest,
    rawSignPolygonTransactionRequest,
} from '@/lib/SignPolygonTransactionRequestParsing';
import { RequestType } from '../../client/PublicRequestTypes';
import type { SignPolygonTransactionRequest } from '../../client/PublicRequestTypes';

setup();

// The Keyguard validates gasless transfers against its own pins and fee limit. The Hub only checks the shape and
// forwards the plain transfer fields, never typed data or calldata.

const TRANSFER = {
    token: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    from: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    to: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    amount: '10000000',
    fee: '10000',
    relay: '0xBcd4042DE499D14e55001CcbB24a551F3b954096',
};

function parse(request: Partial<SignPolygonTransactionRequest> & Record<string, unknown>) {
    return parseSignPolygonTransactionRequest(
        { appName: 'Test App', request: TRANSFER, tokenNonce: 0, ...request } as SignPolygonTransactionRequest,
    );
}

describe('SIGN_POLYGON_TRANSACTION request parsing', () => {
    it('keeps only the gasless transfer fields', () => {
        const parsed = parse({
            recipientLabel: 'Alice',
            // Fields of the former OpenGSN request or unknown fields must not be forwarded to the Keyguard
            relayData: { forwarder: '0x0000000000000000000000000000000000000001' },
        } as any);
        expect(parsed.kind).toBe(RequestType.SIGN_POLYGON_TRANSACTION);
        expect(parsed.request).toEqual(TRANSFER);
        expect(parsed.tokenNonce).toBe(0);
        expect(parsed.corrects).toBeUndefined();
        expect(parsed.recipientLabel).toBe('Alice');
        expect('relayData' in parsed).toBe(false);

        const raw = rawSignPolygonTransactionRequest(parsed);
        expect(parse(raw as any)).toEqual(parsed);
    });

    it('parses a correction of an earlier version', () => {
        const corrects = {
            ...TRANSFER,
            fee: '5000',
            nonce: `0x${'ab'.repeat(32)}`,
            deadline: '1790000600',
        };
        expect(parse({ corrects }).corrects).toEqual(corrects);
        expect(() => parse({ corrects: { ...corrects, nonce: '0x1234' } })).toThrow();
        expect(() => parse({ corrects: { ...corrects, deadline: 1790000600 as any } })).toThrow();
    });

    it('rejects malformed transfers', () => {
        expect(() => parse({ request: undefined })).toThrow();
        expect(() => parse({ request: { ...TRANSFER, to: 'NQ07 0000' } })).toThrow();
        expect(() => parse({ request: { ...TRANSFER, amount: 10000000 as any } })).toThrow();
        expect(() => parse({ request: { ...TRANSFER, fee: '-1' } })).toThrow();
        expect(() => parse({ tokenNonce: -1 })).toThrow();
        expect(() => parse({ tokenNonce: '0' as any })).toThrow();
    });
});
