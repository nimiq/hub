import { setup } from './_setup';
import {
    keyguardMultisigTransactionInfo,
    parseCreateMultisigCommitmentsRequest,
    parseSignMultisigTransactionRequest,
    rawCreateMultisigCommitmentsRequest,
    rawSignMultisigTransactionRequest,
} from '@/lib/MultisigRequestParsing';
import { RequestType } from '../../client/PublicRequestTypes';
import type {
    CreateMultisigCommitmentsRequest,
    SignMultisigTransactionRequest,
} from '../../client/PublicRequestTypes';

setup();

const PUBLIC_KEYS = [
    '0101010101010101010101010101010101010101010101010101010101010101',
    '0202020202020202020202020202020202020202020202020202020202020202',
];

const TRANSACTION = {
    appName: 'Test App',
    signer: 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000',
    sender: 'NQ82 HP54 C9D4 2FAG 69QD 6Q71 LURR 5187 0V3X',
    senderLabel: 'Our Multisig Wallet',
    recipient: 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000',
    recipientLabel: 'Best Friend',
    value: 1e5,
    extraData: 'hello',
    validityStartHeight: 1,
};

const ROUND_1: CreateMultisigCommitmentsRequest = {
    ...TRANSACTION,
    multisigConfig: { publicKeys: PUBLIC_KEYS, numberOfSigners: 2, userName: 'Antoine' },
};

const ROUND_2: SignMultisigTransactionRequest = {
    ...TRANSACTION,
    multisigConfig: {
        publicKeys: PUBLIC_KEYS,
        signers: PUBLIC_KEYS.map((publicKey) => ({ publicKey, commitments: ['aa'.repeat(32), 'bb'.repeat(32)] })),
        state: 'cc'.repeat(193),
        userName: 'Antoine',
    },
};

describe('Multisig request parsing', () => {
    it('forwards the identical transaction to the Keyguard in both rounds', () => {
        const round1 = parseCreateMultisigCommitmentsRequest(ROUND_1);
        const round2 = parseSignMultisigTransactionRequest(ROUND_2);
        expect(round1.kind).toBe(RequestType.CREATE_MULTISIG_COMMITMENTS);
        expect(round2.kind).toBe(RequestType.SIGN_MULTISIG_TRANSACTION);
        expect(keyguardMultisigTransactionInfo(round1)).toEqual(keyguardMultisigTransactionInfo(round2));
        expect(keyguardMultisigTransactionInfo(round1)).toEqual(expect.objectContaining({
            fee: 0,
            flags: 0,
            recipientData: new Uint8Array([104, 101, 108, 108, 111]),
        }));
    });

    it('parses the round 1 multisig config', () => {
        const { multisigConfig } = parseCreateMultisigCommitmentsRequest(ROUND_1);
        expect(multisigConfig.publicKeys).toEqual(PUBLIC_KEYS.map((key) => Nimiq.BufferUtils.fromHex(key)));
        expect(multisigConfig.numberOfSigners).toBe(2);
        expect(multisigConfig.userName).toBe('Antoine');
    });

    it('rejects an invalid numberOfSigners', () => {
        for (const numberOfSigners of [0, -1, 1.5, '2', undefined]) {
            expect(() => parseCreateMultisigCommitmentsRequest({
                ...ROUND_1,
                multisigConfig: { ...ROUND_1.multisigConfig, numberOfSigners: numberOfSigners as number },
            })).toThrow('numberOfSigners');
        }
    });

    it('parses the round 2 state', () => {
        const { multisigConfig } = parseSignMultisigTransactionRequest(ROUND_2);
        expect(multisigConfig.state).toEqual(Nimiq.BufferUtils.fromHex('cc'.repeat(193)));
        expect(multisigConfig).not.toHaveProperty('secrets');
    });

    it('rejects commitment secrets and a missing state', () => {
        const { state, ...configWithoutState } = ROUND_2.multisigConfig;
        expect(() => parseSignMultisigTransactionRequest({
            ...ROUND_2,
            multisigConfig: { ...configWithoutState, secrets: ['dd'.repeat(32)] } as any,
        })).toThrow('secrets are not supported anymore');
        expect(() => parseSignMultisigTransactionRequest({
            ...ROUND_2,
            multisigConfig: configWithoutState as any,
        })).toThrow('multisigConfig.state');
    });

    it('maps parsed requests back to equivalent raw requests', () => {
        // Addresses are wasm objects, which can't be compared with toEqual, thus compare the forwarded fields instead.
        const forwarded = (request: ReturnType<typeof parseCreateMultisigCommitmentsRequest>
            | ReturnType<typeof parseSignMultisigTransactionRequest>) => ({
            signer: request.signer.toUserFriendlyAddress(),
            senderLabel: request.senderLabel,
            ...keyguardMultisigTransactionInfo(request),
            multisigConfig: request.multisigConfig,
        });
        const round1 = parseCreateMultisigCommitmentsRequest(ROUND_1);
        expect(forwarded(parseCreateMultisigCommitmentsRequest(rawCreateMultisigCommitmentsRequest(round1))))
            .toEqual(forwarded(round1));
        const round2 = parseSignMultisigTransactionRequest(ROUND_2);
        expect(forwarded(parseSignMultisigTransactionRequest(rawSignMultisigTransactionRequest(round2))))
            .toEqual(forwarded(round2));
    });
});
