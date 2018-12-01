import { setup } from './_setup';
import { WalletInfo, WalletType } from '@/lib/WalletInfo';
import { AccountInfo } from '@/lib/AccountInfo';
import { ContractType } from '@/lib/ContractInfo';
import { CookieJar } from '@/lib/CookieJar';

setup();

const DUMMY_ADDRESS_HR = 'NQ86 6D3H 6MVD 2JV4 N77V FNA5 M9BL 2QSP 1P64';
const BURN_ADDRESS_HR  = 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000';
const DUMMY_ADDRESS: Nimiq.Address = Nimiq.Address.fromUserFriendlyAddress(DUMMY_ADDRESS_HR);
const DUMMY_ADDRESS_S = Uint8Array.from(DUMMY_ADDRESS.serialize());
const BURN_ADDRESS  = Nimiq.Address.fromUserFriendlyAddress(BURN_ADDRESS_HR);
console.log(Uint8Array.from(DUMMY_ADDRESS.serialize()));
const RAW_WALLETS: WalletInfo[] = [
    new WalletInfo('1ee3d926a49c', 'Main',
        new Map<string, AccountInfo>([
            [
                DUMMY_ADDRESS_HR,
                new AccountInfo(
                    'm/0\'',
                    'MyAccount',
                    DUMMY_ADDRESS)],
            ]),
        [],
        WalletType.BIP39),
    new WalletInfo('1ee3d926a49d', 'Ledger',
        new Map<string, AccountInfo>([
            [
                BURN_ADDRESS_HR,
                new AccountInfo(
                    'm/0\'',
                    'MyLedger',
                    BURN_ADDRESS)] ]),
        [{ // ContractInfo
            address: DUMMY_ADDRESS_S,
            label: 'Savings',
            ownerPath: 'm/0\'',
            type: ContractType.VESTING,
        }],
        WalletType.LEDGER),
    new WalletInfo('1ee3d926a49e', 'Old',
        new Map<string, AccountInfo>([
            [
                BURN_ADDRESS_HR,
                new AccountInfo(
                    'm/0\'',
                    'OldAccount',
                    BURN_ADDRESS)],
        ]),
        [],
        WalletType.LEGACY),
];

const DUMMIES = RAW_WALLETS.map((wallet) => wallet.toObject());
const DUMMY = DUMMIES[0];

const beforeEachCallback = async () => {
};

const afterEachCallback = async () => {
};

describe('CookieJar', () => {

    beforeEach(beforeEachCallback);

    afterEach(afterEachCallback);

    it('fill sets cookie', () => {
        CookieJar.fill(DUMMIES);
        const cookie = document.cookie;
        expect(cookie).not.toBeNull();
        expect(cookie.length).toBeGreaterThan(DUMMIES.length * 50);
        expect(cookie).toBe(CookieJar.encodeWallets(DUMMIES));
        console.log(cookie);
    });

    it('fill produces same string', () => {
        CookieJar.fill(DUMMIES);
        const first = document.cookie;
        CookieJar.fill(DUMMIES);
        const second = document.cookie;
        expect(first).toBe(second);
        console.log(first.length, first);
    });

    it('encode and decode base 64', () => {
        const test = Uint8Array.from('tes'.split('').map((character) => character.codePointAt(0)) as number[]);
        const encoded = CookieJar.base64Encode(test);
        const decoded = CookieJar.base64Decode(encoded);
        expect(decoded).toEqual(test);
    });

    it('encode and decode address', () => {
        const address = DUMMY.accounts.values().next().value.address;
        console.log(Array.from(address.values()).map((b) => b.toString(2)).join(','));
        const encoded = CookieJar.encodeAddress(address);
        console.log(encoded);
        expect(encoded.length).toBeLessThanOrEqual(21 * 4 / 3);
        const decoded = CookieJar.decodeAddress(encoded);
        console.log(Array.from(decoded.values()).map((b) => b.toString(2)).join(','));
        expect(decoded).toEqual(address);
    });

    it('encode and decode ID', () => {
        expect(DUMMY.id).toBe(CookieJar.decodeId(CookieJar.encodeId(DUMMY.id)));
        console.log(CookieJar.encodeId(DUMMY.id));
    });

    it('encode and decode type', () => {
        const type = CookieJar.encodeType(DUMMY.type);
        expect(type).toHaveLength(1);
        expect(CookieJar.decodeType(type)).toBe(DUMMY.type);
    });

    it('Encode and decode reproduce source', () => {
        const encoded = CookieJar.encodeWallets(DUMMIES);
        const wallets = encoded.split(CookieJar.Separator.WALLET);
        // https://stackoverflow.com/questions/2219526/how-many-bytes-in-a-javascript-string
        console.log(`Serialized size: ${ encodeURI(encoded).split(/%(?:u[0-9A-F]{2})?[0-9A-F]{2}|./).length - 1   }`);
        // 215 for CookieJar 1
        console.log(wallets.length);
        console.log(wallets.join('\n---\n'));
        expect(encoded.length).toBeGreaterThan(100);
        expect(CookieJar.decodeWallets(encoded)).toEqual(DUMMIES);
    });
});
