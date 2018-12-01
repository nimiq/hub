// tslint:disable
import { setup } from './_setup';
import { WalletType, WalletInfoEntry } from '@/lib/WalletInfo';
import { AccountInfoEntry } from '@/lib/AccountInfo';
import { ContractType } from '@/lib/ContractInfo';
import CookieJar from '@/lib/CookieJar';
import { Utf8Tools } from '@nimiq/utils';

setup();

const DUMMY_ADDRESS_HR1 = 'NQ86 6D3H 6MVD 2JV4 N77V FNA5 M9BL 2QSP 1P64';
const DUMMY_ADDRESS_HR2 = 'NQ36 CPYA UTCK VBBG L5GG 8D36 SNHM K8MH DD7X';
const DUMMY_ADDRESS1: Nimiq.Address = Nimiq.Address.fromUserFriendlyAddress(DUMMY_ADDRESS_HR1);
const DUMMY_ADDRESS2: Nimiq.Address = Nimiq.Address.fromUserFriendlyAddress(DUMMY_ADDRESS_HR2);
const DUMMY_ADDRESS_S1 = new Uint8Array(DUMMY_ADDRESS1.serialize());
const DUMMY_ADDRESS_S2 = new Uint8Array(DUMMY_ADDRESS2.serialize());
const BURN_ADDRESS_HR  = 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000';
const BURN_ADDRESS  = Nimiq.Address.fromUserFriendlyAddress(BURN_ADDRESS_HR);
const BURN_ADDRESS_S = new Uint8Array(BURN_ADDRESS.serialize());

const DUMMY_WALLET_OBJECTS: WalletInfoEntry[] = [
    {
        id: '1ee3d926a49c',
        label: 'Main 🙉',
        accounts: new Map<string, AccountInfoEntry>([
            [
                DUMMY_ADDRESS_HR1,
                {
                    path: 'm/0\'',
                    label: 'MyAccount1',
                    address: DUMMY_ADDRESS_S1,
                },
            ],
            [
                DUMMY_ADDRESS_HR2,
                {
                    path: 'm/0\'',
                    label: '',
                    address: DUMMY_ADDRESS_S2,
                },
            ],
        ]),
        contracts: [],
        type: WalletType.BIP39,
    },
    {
        id: '1ee3d926a49d',
        label: '',
        accounts: new Map<string, AccountInfoEntry>([
            [
                BURN_ADDRESS_HR,
                {
                    path: 'm/0\'',
                    label: 'Daniel\'s Ledger ❤',
                    address: BURN_ADDRESS_S,
                },
            ],
        ]),
        contracts: [{
            address: DUMMY_ADDRESS1,
            label: 'Savings',
            ownerPath: 'm/0\'',
            type: ContractType.VESTING,
        }],
        type: WalletType.LEDGER,
    },
    {
        id: '1ee3d926a49e',
        label: 'My old wallet',
        accounts: new Map<string, AccountInfoEntry>([
            [
                DUMMY_ADDRESS_HR2,
                {
                    path: 'm/0\'',
                    label: 'OldAccount',
                    address: DUMMY_ADDRESS_S2,
                },
            ],
        ]),
        contracts: [],
        type: WalletType.LEGACY,
    },
];

const OUT_DUMMY_WALLET_OBJECTS: WalletInfoEntry[] = [
    {
        id: '1ee3d926a49c',
        label: 'Main 🙉',
        accounts: new Map<string, AccountInfoEntry>([
            [
                DUMMY_ADDRESS_HR1,
                {
                    path: 'not public',
                    label: 'MyAccount1',
                    address: DUMMY_ADDRESS_S1,
                },
            ],
            [
                DUMMY_ADDRESS_HR2,
                {
                    path: 'not public',
                    label: 'Standard Account',
                    address: DUMMY_ADDRESS_S2,
                },
            ],
        ]),
        contracts: [],
        type: WalletType.BIP39,
    },
    {
        id: '1ee3d926a49d',
        label: 'Ledger Wallet',
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
        contracts: [],
        type: WalletType.LEDGER,
    },
    {
        id: '1ee3d926a49e',
        label: 'Legacy Wallet',
        accounts: new Map<string, AccountInfoEntry>([
            [
                DUMMY_ADDRESS_HR2,
                {
                    path: 'not public',
                    label: 'OldAccount',
                    address: DUMMY_ADDRESS_S2,
                },
            ],
        ]),
        contracts: [],
        type: WalletType.LEGACY,
    },
];

const BYTES = [
    1, // cookie version

    // wallet 1 (BIP39)
    30, 227, 217, 38, 164, 156, // wallet id
    37, // wallet label length (9), wallet type (1)
    77, 97, 105, 110, 32, 240, 159, 153, 137, // wallet label
    2, // number of accounts

        // account 1
        10, // account label length
        77, 121, 65, 99, 99, 111, 117, 110, 116, 49, // account label
        51, 71, 19, 87, 173, 20, 186, 75, 28, 253, 125, 148, 90, 165, 116, 22, 53, 112, 220, 196, // account address

        // account 2
        0, // account label length
        101, 254, 174, 109, 147, 234, 215, 10, 22, 16, 67, 70, 109, 90, 53, 154, 43, 22, 180, 254, // account address

    // wallet 2 (LEDGER)
    30, 227, 217, 38, 164, 157, // wallet id
    2, // wallet label length (0), wallet type (2)
    1, // number of accounts

        // account 1
        19, // account label length
        68, 97, 110, 105, 101, 108, 39, 115, 32, 76, 101, 100, 103, 101, 114, 32, 226, 157, 164, // account label
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // account address

    // wallet 3 (LEGACY)
    30, 227, 217, 38, 164, 158, // wallet id
    40, // account label length (10), wallet type (0)

        // account
        79, 108, 100, 65, 99, 99, 111, 117, 110, 116, // account label
        101, 254, 174, 109, 147, 234, 215, 10, 22, 16, 67, 70, 109, 90, 53, 154, 43, 22, 180, 254, // account address
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
        const LABEL_1 = 'Standard Account'; // 16 chars, 16 byte
        const LABEL_2 = 'Very very very very very very very very very very very long ASCII label'; // 71 chars, 71 byte
        const LABEL_3 = 'Label ❤ with ❤ multi 🙉 byte 🙉 characters that is very long indeed'; // 67 chars, 75 byte
        const LABEL_4 = 'Label with a multibyte character at the max length position: 🙉'; // 63 chars, 65 byte

        const CUT_LABEL_1 = 'Standard Account'; // 16 byte
        const CUT_LABEL_2 = 'Very very very very very very very very very very very long ASC'; // 63 byte
        const CUT_LABEL_3 = 'Label ❤ with ❤ multi 🙉 byte 🙉 characters that is very'; // 63 byte
        const CUT_LABEL_4 = 'Label with a multibyte character at the max length position: '; // 61 byte

        expect(Utf8Tools.utf8ByteArrayToString(CookieJar.cutLabel(LABEL_1))).toEqual(CUT_LABEL_1);
        expect(Utf8Tools.utf8ByteArrayToString(CookieJar.cutLabel(LABEL_2))).toEqual(CUT_LABEL_2);
        expect(Utf8Tools.utf8ByteArrayToString(CookieJar.cutLabel(LABEL_3))).toEqual(CUT_LABEL_3);
        expect(Utf8Tools.utf8ByteArrayToString(CookieJar.cutLabel(LABEL_4))).toEqual(CUT_LABEL_4);
    });
});
