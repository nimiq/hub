import { setup } from './_setup';
import { WalletType, WalletInfoEntry } from '@/lib/WalletInfo';
import { AccountInfoEntry } from '@/lib/AccountInfo';
import CookieJar from '@/lib/CookieJar';
import { Utf8Tools } from '@nimiq/utils';

setup();

const DUMMY_ADDRESS_HR1 = 'NQ86 6D3H 6MVD 2JV4 N77V FNA5 M9BL 2QSP 1P64';
const DUMMY_ADDRESS_HR2 = 'NQ36 CPYA UTCK VBBG L5GG 8D36 SNHM K8MH DD7X';
const DUMMY_ADDRESS_HRV = 'NQ76 E5NX K4S8 9RS9 65FC DQ8C H5ML SCYG 81XJ'; // Vesting contract address
const DUMMY_ADDRESS1: Nimiq.Address = Nimiq.Address.fromUserFriendlyAddress(DUMMY_ADDRESS_HR1);
const DUMMY_ADDRESS2: Nimiq.Address = Nimiq.Address.fromUserFriendlyAddress(DUMMY_ADDRESS_HR2);
const DUMMY_ADDRESSV: Nimiq.Address = Nimiq.Address.fromUserFriendlyAddress(DUMMY_ADDRESS_HRV);
const DUMMY_ADDRESS_S1 = new Uint8Array(DUMMY_ADDRESS1.serialize());
const DUMMY_ADDRESS_S2 = new Uint8Array(DUMMY_ADDRESS2.serialize());
const DUMMY_ADDRESS_SV = new Uint8Array(DUMMY_ADDRESSV.serialize());
const BURN_ADDRESS_HR  = 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000';
const BURN_ADDRESS  = Nimiq.Address.fromUserFriendlyAddress(BURN_ADDRESS_HR);
const BURN_ADDRESS_S = new Uint8Array(BURN_ADDRESS.serialize());

const DUMMY_WALLET_OBJECTS: WalletInfoEntry[] = [
    {
        id: '0fe6067b138f',
        keyId: 'D+YGexOP0yDjr3Uf6WwO9a2/WjhNbZFLrRwdLfuvz9c=',
        label: 'Teal Account',
        accounts: new Map<string, AccountInfoEntry>([
            [
                DUMMY_ADDRESS_HR1,
                {
                    path: 'm/44\'/242\'/0\'/0\'',
                    label: 'MyAddress1',
                    address: DUMMY_ADDRESS_S1,
                },
            ],
            [
                DUMMY_ADDRESS_HR2,
                {
                    path: 'm/44\'/242\'/0\'/5\'',
                    label: 'Divine Wizarding Parakeet',
                    address: DUMMY_ADDRESS_S2,
                },
            ],
        ]),
        contracts: [],
        type: WalletType.BIP39,
        keyMissing: true,
        fileExported: false,
        wordsExported: false,
    },
    {
        id: '1ee3d926a49d',
        keyId: '',
        label: 'Monkey Family 🙉',
        accounts: new Map<string, AccountInfoEntry>([
            [
                BURN_ADDRESS_HR,
                {
                    path: 'm/44\'/242\'/0\'/0\'',
                    label: 'Daniel\'s Ledger ❤',
                    address: BURN_ADDRESS_S,
                },
            ],
        ]),
        contracts: [{
            type: Nimiq.Account.Type.VESTING,
            label: 'Vesting Contract',
            address: DUMMY_ADDRESS_SV,
            owner: BURN_ADDRESS_S,
            start: 0,
            stepAmount: 419229878121,
            stepBlocks: 2880,
            totalAmount: 2515379268724,
        }],
        type: WalletType.LEDGER,
        keyMissing: true,
        fileExported: true,
        wordsExported: false,
    },
    {
        id: '2978bf29b377',
        keyId: 'KXi/KbN35+oYAIV2ummFjLWxfY/47fo/35Hfa3WNVA0=',
        label: 'My old wallet',
        accounts: new Map<string, AccountInfoEntry>([
            [
                DUMMY_ADDRESS_HR2,
                {
                    path: 'm/0\'',
                    label: 'OldAddress',
                    address: DUMMY_ADDRESS_S2,
                },
            ],
        ]),
        contracts: [],
        type: WalletType.LEGACY,
        keyMissing: true,
        fileExported: false,
        wordsExported: true,
    },
    {
        id: '78bf29b377e7',
        keyId: 'KXi/KbN35+oYAIV2ummFjLWxfY/47fo/35Hfa3WNVA1=',
        label: 'Main 🙉',
        accounts: new Map<string, AccountInfoEntry>([
            [
                DUMMY_ADDRESS_HR1,
                {
                    path: 'm/44\'/242\'/0\'/0\'',
                    label: 'Marine Chirping Inliner',
                    address: DUMMY_ADDRESS_S1,
                },
            ],
            [
                DUMMY_ADDRESS_HR2,
                {
                    path: 'm/44\'/242\'/0\'/5\'',
                    label: 'MyAddress2',
                    address: DUMMY_ADDRESS_S2,
                },
            ],
        ]),
        contracts: [],
        type: WalletType.BIP39,
        keyMissing: false,
        fileExported: true,
        wordsExported: true,
    },
    {
        id: 'a5832a3b9489',
        keyId: '',
        label: 'Ledger Account',
        accounts: new Map<string, AccountInfoEntry>([
            [
                BURN_ADDRESS_HR,
                {
                    path: 'm/44\'/242\'/0\'/0\'',
                    label: 'Inline Meat-Loving Sorcerer',
                    address: BURN_ADDRESS_S,
                },
            ],
        ]),
        contracts: [],
        type: WalletType.LEDGER,
        keyMissing: false,
        fileExported: false,
        wordsExported: false,
    },
    {
        id: 'd515aa19c4f7',
        keyId: '1RWqGcT3D8UENcv+45EjgTe0kHxmUUP35mjW6qUQGbE=',
        label: 'My old wallet',
        accounts: new Map<string, AccountInfoEntry>([
            [
                DUMMY_ADDRESS_HR2,
                {
                    path: 'm/0\'',
                    label: 'OldAddress',
                    address: DUMMY_ADDRESS_S2,
                },
            ],
        ]),
        contracts: [{
            type: Nimiq.Account.Type.VESTING,
            label: 'Custom Label',
            address: DUMMY_ADDRESS_SV,
            owner: DUMMY_ADDRESS_S2,
            start: 400000,
            stepAmount: 419229878121,
            stepBlocks: 28800,
            totalAmount: 2515379268724,
        }],
        type: WalletType.LEGACY,
        keyMissing: false,
        fileExported: true,
        wordsExported: false,
    },
];

const OUT_DUMMY_WALLET_OBJECTS: WalletInfoEntry[] = [
    {
        id: '0fe6067b138f',
        keyId: '',
        label: 'Teal Account',
        accounts: new Map<string, AccountInfoEntry>([
            [
                DUMMY_ADDRESS_HR1,
                {
                    path: 'not public',
                    label: 'MyAddress1',
                    address: DUMMY_ADDRESS_S1,
                },
            ],
            [
                DUMMY_ADDRESS_HR2,
                {
                    path: 'not public',
                    label: 'Divine Wizarding Parakeet',
                    address: DUMMY_ADDRESS_S2,
                },
            ],
        ]),
        contracts: [],
        type: WalletType.BIP39,
        keyMissing: true,
        fileExported: false,
        wordsExported: false,
    },
    {
        id: '1ee3d926a49d',
        keyId: '',
        label: 'Monkey Family 🙉',
        accounts: new Map<string, AccountInfoEntry>([
            [
                BURN_ADDRESS_HR,
                {
                    path: 'not public',
                    label: 'Daniel\'s Ledger ❤',
                    address: BURN_ADDRESS_S,
                },
            ],
        ]),
        contracts: [{
            type: Nimiq.Account.Type.VESTING,
            label: 'Vesting Contract',
            address: DUMMY_ADDRESS_SV,
            owner: BURN_ADDRESS_S,
            start: 0,
            stepAmount: 419229878121,
            stepBlocks: 2880,
            totalAmount: 2515379268724,
        }],
        type: WalletType.LEDGER,
        keyMissing: true,
        fileExported: true,
        wordsExported: false,
    },
    {
        id: '2978bf29b377',
        keyId: '',
        label: 'Legacy Account',
        accounts: new Map<string, AccountInfoEntry>([
            [
                DUMMY_ADDRESS_HR2,
                {
                    path: 'not public',
                    label: 'OldAddress',
                    address: DUMMY_ADDRESS_S2,
                },
            ],
        ]),
        contracts: [],
        type: WalletType.LEGACY,
        keyMissing: true,
        fileExported: false,
        wordsExported: true,
    },
    {
        id: '78bf29b377e7',
        keyId: '',
        label: 'Main 🙉',
        accounts: new Map<string, AccountInfoEntry>([
            [
                DUMMY_ADDRESS_HR1,
                {
                    path: 'not public',
                    label: 'Marine Chirping Inliner',
                    address: DUMMY_ADDRESS_S1,
                },
            ],
            [
                DUMMY_ADDRESS_HR2,
                {
                    path: 'not public',
                    label: 'MyAddress2',
                    address: DUMMY_ADDRESS_S2,
                },
            ],
        ]),
        contracts: [],
        type: WalletType.BIP39,
        keyMissing: false,
        fileExported: true,
        wordsExported: true,
    },
    {
        id: 'a5832a3b9489',
        keyId: '',
        label: 'Ledger Account',
        accounts: new Map<string, AccountInfoEntry>([
            [
                BURN_ADDRESS_HR,
                {
                    path: 'not public',
                    label: 'Inline Meat-Loving Sorcerer',
                    address: BURN_ADDRESS_S,
                },
            ],
        ]),
        contracts: [],
        type: WalletType.LEDGER,
        keyMissing: false,
        fileExported: false,
        wordsExported: false,
    },
    {
        id: 'd515aa19c4f7',
        keyId: '',
        label: 'Legacy Account',
        accounts: new Map<string, AccountInfoEntry>([
            [
                DUMMY_ADDRESS_HR2,
                {
                    path: 'not public',
                    label: 'OldAddress',
                    address: DUMMY_ADDRESS_S2,
                },
            ],
        ]),
        contracts: [{
            type: Nimiq.Account.Type.VESTING,
            label: 'Custom Label',
            address: DUMMY_ADDRESS_SV,
            owner: DUMMY_ADDRESS_S2,
            start: 400000,
            stepAmount: 419229878121,
            stepBlocks: 28800,
            totalAmount: 2515379268724,
        }],
        type: WalletType.LEGACY,
        keyMissing: false,
        fileExported: true,
        wordsExported: false,
    },
];

const BYTES = [
    3, // cookie version

    // wallet 1 (BIP39)
    2, // wallet label length (0), wallet type (2)
    0b00000001, // Status byte: keyMissing = true, fileExported = false, wordsExported = false, hasContracts = false
    0x0f, 0xe6, 0x06, 0x7b, 0x13, 0x8f, // wallet id
    // wallet label (omitted)
    2, // number of accounts

        // account 1
        10, // account label length
        77, 121, 65, 100, 100, 114, 101, 115, 115, 49, // account label
        51, 71, 19, 87, 173, 20, 186, 75, 28, 253, 125, 148, 90, 165, 116, 22, 53, 112, 220, 196, // account address

        // account 2
        0, // account label length
        // account label (omitted)
        101, 254, 174, 109, 147, 234, 215, 10, 22, 16, 67, 70, 109, 90, 53, 154, 43, 22, 180, 254, // account address

    // wallet 2 (LEDGER)
    75, // wallet label length (18), wallet type (3)
    0b00001011, // Status byte: keyMissing = true, fileExported = true, wordsExported = false, hasContracts = true
    0x1e, 0xe3, 0xd9, 0x26, 0xa4, 0x9d, // wallet id
    77, 111, 110, 107, 101, 121, 32, 70, 97, 109, 105, 108, 121, 32, 240, 159, 153, 137, // wallet label
    1, // number of accounts

        // account 1
        19, // account label length
        68, 97, 110, 105, 101, 108, 39, 115, 32, 76, 101, 100, 103, 101, 114, 32, 226, 157, 164, // account label
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // account address

    // number of contracts
    1,

        // contract 1
        1, // contract label length (0), contract type (1)
        // contract label (omitted)
        113, 109, 233, 147, 72, 78, 116, 147, 21, 236, 110, 16, 200, 150, 180, 211, 63, 4, 7, 210, // contract address
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // owner address
        0, 0, 0, 0, // start
        0, 0, 0, 97, 156, 12, 71, 105, // step amount
        0, 0, 11, 64, // step blocks
        0, 0, 2, 73, 168, 73, 172, 116, // total amount

    // wallet 3 (LEGACY)
    41, // account label length (10), wallet type (1)
    0b00000101, // Status byte: keyMissing = true, fileExported = false, wordsExported = true, hasContracts = false
    0x29, 0x78, 0xbf, 0x29, 0xb3, 0x77, // wallet id

        // account
        79, 108, 100, 65, 100, 100, 114, 101, 115, 115, // account label
        101, 254, 174, 109, 147, 234, 215, 10, 22, 16, 67, 70, 109, 90, 53, 154, 43, 22, 180, 254, // account address

    // wallet 4 (BIP39)
    38, // wallet label length (9), wallet type (2)
    0b00000110, // Status byte: keyMissing = false, fileExported = true, wordsExported = true, hasContracts = false
    0x78, 0xbf, 0x29, 0xb3, 0x77, 0xe7, // wallet id
    77, 97, 105, 110, 32, 240, 159, 153, 137, // wallet label
    2, // number of accounts

        // account 1
        0, // account label length
        // account label (omitted)
        51, 71, 19, 87, 173, 20, 186, 75, 28, 253, 125, 148, 90, 165, 116, 22, 53, 112, 220, 196, // account address

        // account 2
        10, // account label length
        77, 121, 65, 100, 100, 114, 101, 115, 115, 50, // account label
        101, 254, 174, 109, 147, 234, 215, 10, 22, 16, 67, 70, 109, 90, 53, 154, 43, 22, 180, 254, // account address

    // wallet 5 (LEDGER)
    3, // wallet label length (0), wallet type (3)
    0b00000000, // Status byte: keyMissing = false, fileExported = false, wordsExported = false, hasContracts = false
    0xa5, 0x83, 0x2a, 0x3b, 0x94, 0x89, // wallet id
    // wallet label (omitted)
    1, // number of accounts

        // account 1
        0, // account label length
        // account label (omitted)
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // account address

    // wallet 6 (LEGACY)
    41, // account label length (10), wallet type (1)
    0b00001010, // Status byte: keyMissing = false, fileExported = true, wordsExported = false, hasContracts = true
    0xd5, 0x15, 0xaa, 0x19, 0xc4, 0xf7, // wallet id

        // account
        79, 108, 100, 65, 100, 100, 114, 101, 115, 115, // account label
        101, 254, 174, 109, 147, 234, 215, 10, 22, 16, 67, 70, 109, 90, 53, 154, 43, 22, 180, 254, // account address

    // number of contracts
    1,

        // contract 1
        49, // contract label length (12), contract type (1)
        67, 117, 115, 116, 111, 109, 32, 76, 97, 98, 101, 108, // contract label
        113, 109, 233, 147, 72, 78, 116, 147, 21, 236, 110, 16, 200, 150, 180, 211, 63, 4, 7, 210, // contract address
        101, 254, 174, 109, 147, 234, 215, 10, 22, 16, 67, 70, 109, 90, 53, 154, 43, 22, 180, 254, // owner address
        0, 6, 26, 128, // start
        0, 0, 0, 97, 156, 12, 71, 105, // step amount
        0, 0, 112, 128, // step blocks
        0, 0, 2, 73, 168, 73, 172, 116, // total amount
];

const BASE64 = Nimiq.BufferUtils.toBase64(new Uint8Array(BYTES));
const COOKIE = `w=${BASE64}`;

describe('CookieJar', () => {

    // Clear cookie before and after each test
    const clearCookie = () => document.cookie = 'w=; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    beforeEach(clearCookie);
    afterEach(clearCookie);

    it('can fill a cookie', () => {
        CookieJar.fill(DUMMY_WALLET_OBJECTS);
        const cookie = document.cookie;

        expect(cookie).toEqual(COOKIE);
    });

    it('can eat from a cookie', async () => {
        document.cookie = `${COOKIE}; max-age=${(60 * 60 * 24 * 365).toString()}`;
        const wallets = await CookieJar.eat();

        expect(wallets).toEqual(OUT_DUMMY_WALLET_OBJECTS);
    });

    it('can encode and decode to reproduce source object', async () => {
        const encoded = CookieJar.encodeCookie(DUMMY_WALLET_OBJECTS);
        const decoded = await CookieJar.decodeCookie(encoded);

        expect(decoded).toEqual(OUT_DUMMY_WALLET_OBJECTS);
    });

    it('can correctly cut overlong labels', () => {
        // 16 chars, 16 byte
        const LABEL_1 = 'Standard Address';
        // 71 chars, 71 byte
        const LABEL_2 = 'Very very very very very very very very very very very long ASCII label';
        // 65 symbols, 67 chars (the monkeys are astral symbols consisting of 2 surrogate pairs), 75 byte
        const LABEL_3 = 'Label ❤ with ❤ multi 🙉 byte 🙉 characters that is very long indeed';
        // 60 symbols, 62 chars, 66 byte
        const LABEL_4 = 'Label with a multibyte character at the max len position: 🙉🙉';

        const CUT_LABEL_1 = 'Standard Address'; // 16 byte
        const CUT_LABEL_2 = 'Very very very very very very very very very very very long …'; // 63 byte
        const CUT_LABEL_3 = 'Label ❤ with ❤ multi 🙉 byte 🙉 characters that is v…'; // 63 byte
        const CUT_LABEL_4 = 'Label with a multibyte character at the max len position: …'; // 61 byte

        expect(Utf8Tools.utf8ByteArrayToString(CookieJar.encodeAndcutLabel(LABEL_1))).toEqual(CUT_LABEL_1);
        expect(Utf8Tools.utf8ByteArrayToString(CookieJar.encodeAndcutLabel(LABEL_2))).toEqual(CUT_LABEL_2);
        expect(Utf8Tools.utf8ByteArrayToString(CookieJar.encodeAndcutLabel(LABEL_3))).toEqual(CUT_LABEL_3);
        expect(Utf8Tools.utf8ByteArrayToString(CookieJar.encodeAndcutLabel(LABEL_4))).toEqual(CUT_LABEL_4);
    });

    it('returns no results for old cookie version', async () => {
        // The first byte is the version, the rest is not important
        const oldCookie = Nimiq.BufferUtils.toBase64(new Uint8Array([1, 0, 0, 0, 0, 0]));
        document.cookie = `w=${oldCookie}; max-age=${(60 * 60 * 24 * 365).toString()}`;
        const wallets = await CookieJar.eat();

        expect(wallets).toEqual([]);
    });
});
