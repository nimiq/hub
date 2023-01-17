import { setup } from './_setup';
import { encodeBase58, decodeBase58 } from '../../src/lib/bitcoin/Base58';

setup();

// tslint:disable:max-line-length
const VECTORS = [
    // From https://github.com/bitcoin/bitcoin/blob/master/src/test/data/base58_encode_decode.json
    ['', ''],
    ['61', '2g'],
    ['626262', 'a3gV'],
    ['636363', 'aPEr'],
    ['73696d706c792061206c6f6e6720737472696e67', '2cFupjhnEsSn59qHXstmK2ffpLv2'],
    ['00eb15231dfceb60925886b67d065299925915aeb172c06647', '1NS17iag9jJgTHD1VXjvLCEnZuQ3rJDE9L'],
    ['516b6fcd0f', 'ABnLTmg'],
    ['bf4f89001e670274dd', '3SEo3LWLoPntC'],
    ['572e4794', '3EFU7m'],
    ['ecac89cad93923c02321', 'EJDM8drfXA6uyA'],
    ['10c8511e', 'Rt5zm'],
    ['00000000000000000000', '1111111111'],
    ['000111d38e5fc9071ffcd20b4a763cc9ae4f252bb4e48fd66a835e252ada93ff480d6dd43dc62a641155a5', '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'],
    ['000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9fa0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7b8b9babbbcbdbebfc0c1c2c3c4c5c6c7c8c9cacbcccdcecfd0d1d2d3d4d5d6d7d8d9dadbdcdddedfe0e1e2e3e4e5e6e7e8e9eaebecedeeeff0f1f2f3f4f5f6f7f8f9fafbfcfdfeff', '1cWB5HCBdLjAuqGGReWE3R3CguuwSjw6RHn39s2yuDRTS5NsBgNiFpWgAnEx6VQi8csexkgYw3mdYrMHr8x9i7aEwP8kZ7vccXWqKDvGv3u1GxFKPuAkn8JCPPGDMf3vMMnbzm6Nh9zh1gcNsMvH3ZNLmP5fSG6DGbbi2tuwMWPthr4boWwCxf7ewSgNQeacyozhKDDQQ1qL5fQFUW52QKUZDZ5fw3KXNQJMcNTcaB723LchjeKun7MuGW5qyCBZYzA1KjofN1gYBV3NqyhQJ3Ns746GNuf9N2pQPmHz4xpnSrrfCvy6TVVz5d4PdrjeshsWQwpZsZGzvbdAdN8MKV5QsBDY'],

    // XPUBs
    ['0488b21e05d880d7d83b9aca00c783e67b921d2beb8f6b389cc646d7263b4145701dadd2161548a8b078e65e9e022a471424da5e657499d1ff51cb43c47481a03b1e77f951fe64cec9f5a48f701118d3a268', 'xpub6H1LXWLaKsWFhvm6RVpEL9P4KfRZSW7abD2ttkWP3SSQvnyA8FSVqNTEcYFgJS2UaFcxupHiYkro49S8yGasTvXEYBVPamhGW6cFJodrTHy'],
    ['0488b21e036f6a84cf8000000092f0a924c8c48ed87d6385dff36f9261ff2d1d92739db0c2c78ef0ea830290f10340bc6a46ca1adac64cc9599c8a6004afd7782c20d2d568a101e3a81029517358f4ad6a21', 'xpub6CUGRUonZSQ4TWtTMmzXdrXDtypWKiKrhko4egpiMZbpiaQL2jkwSB1icqYh2cfDfVxdx4df189oLKnC5fSwqPfgyP3hooxujYzAu3fDVmz'],
    ['043587cf000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000095886114', 'tpubD6NzVbkrYhZ4WLczPJWReQycCJdd6YVWXubbVUFnJ5KgU5MDQrD998ZJLNGbhd2pq7ZtDiPYTfJ7iBenLVQpYgSQqPjUsQeJXH8VQ8xA67D'],
    ['0488b21e024541eb61000000000bd6444237291a36874c4a2902e577f00f82d8e75fba9abbde477146d457cbc902fcba7ecf41bc7e1be4ee122d9d22e3333671eb0a3a87b5cdf099d59874e1940f45b6adad', 'xpub6AHA9hZDN11k2ijHMeS5QqHx2KP9aMBRhTDqANMnwVtdyw2TDYRmF8PjpvwUFcL1Et8Hj59S3gTSMcUQ5gAqTz3Wd8EsMTmF3DChhqPQBnU'],
    ['0488b21e02944aacd000000000d3ee452c90cf42f9e070433301d078cd2b47611dcf6981127020b9fed63bedba03e3e9319a43c574b284fc9797531233278b43b740576cd2cc67c7b316adeb6c409565f5ef', 'xpub6ArrMKgs6b4KxXe72Azj8g8fuoUYhFCytFHh5EqyWSzvrsHH4kLLFhRe1k2QMki9qp5TzE88f7Es8YgjAfPywpw3ZUY4XjBoajSashdz42a'],
    ['0488b21e037527852d80000000ca3d7a2939c2cd9bc2f546de7e0240795920fc3b3d00c91a3092941e88f6ef03024385f9ff0634fec2265501cefe9611b979c3a25eed349b4fd94e70ca2209d75c89e6d789', 'xpub6CWiJoiwxPQni3DFbrQNHWq8kwrL2J1HuBN7zm4xKPCZRmEshc7Dojz4zMah7E4o2GEEbD6HgfG7sQid186Fw9x9akMNKw2mu1PjqacTJB2'],
];
// tslint:enable:max-line-length

describe('Base58', () => {
    it('can correctly encode bytes into base58', () => {
        for (const vector of VECTORS) {
            const bytes = Array.from(Nimiq.BufferUtils.fromHex(vector[0]));
            expect(encodeBase58(bytes)).toEqual(vector[1]);
        }
    });

    it('can correctly decode base58 into bytes', () => {
        for (const vector of VECTORS) {
            const bytes = Array.from(Nimiq.BufferUtils.fromHex(vector[0]));
            expect(decodeBase58(vector[1])).toEqual(bytes);
        }
    });
});
