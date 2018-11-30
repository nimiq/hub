import { setup } from './_setup';
import { WalletInfo, WalletInfoEntry, WalletType } from '@/lib/WalletInfo';
import { AccountInfo } from '@/lib/AccountInfo';
import { ContractType } from '@/lib/ContractInfo';
import { CookieJar } from '@/lib/CookieJar2';
import { Utf8Tools } from '@nimiq/utils';

setup();

const DUMMY_ADDRESS_HR = 'NQ86 6D3H 6MVD 2JV4 N77V FNA5 M9BL 2QSP 1P64';
const BURN_ADDRESS_HR  = 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000';
const DUMMY_ADDRESS: Nimiq.Address = Nimiq.Address.fromUserFriendlyAddress(DUMMY_ADDRESS_HR);
const DUMMY_ADDRESS_S = Uint8Array.from(DUMMY_ADDRESS.serialize());
const BURN_ADDRESS  = Nimiq.Address.fromUserFriendlyAddress(BURN_ADDRESS_HR);
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
                    BURN_ADDRESS)], ]),
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

const DUMMIES = RAW_WALLETS.map(wallet => wallet.toObject());
const DUMMY = DUMMIES[0];
const DUMMY_ACCOUNT = DUMMIES[0].accounts.values().next().value;
const DUMMY_CONTRACT = DUMMIES[1].contracts[0];

const beforeEachCallback = async () => {
};

const afterEachCallback = async () => {
};

describe('CookieJar', () => {

    beforeEach(beforeEachCallback);

    afterEach(afterEachCallback);

    it('test base64 in and out', () => {
        const data = '我asdf';
        let inBuffer = new Nimiq.SerialBuffer(Utf8Tools.stringToUtf8ByteArray(data));
        const base64 = CookieJar.base64Encode(inBuffer);
        const outBuffer = new Nimiq.SerialBuffer(CookieJar.base64Decode(base64));
        const result = Utf8Tools.utf8ByteArrayToString(outBuffer.read(inBuffer.length));
        expect(result).toEqual(data);
    });

    it('encode and decode address', () => {
        const address = DUMMY.accounts.values().next().value.address;
        // console.log(Array.from(address.values()).map(b => b.toString(2)).join(','));
        const buffer = new Nimiq.SerialBuffer(20);
        CookieJar.encodeAddress(address, buffer);
        const decoded = CookieJar.decodeAddress(buffer);
        // console.log(Array.from(decoded.values()).map(b => b.toString(2)).join(','));
        expect(decoded).toEqual(address);
    });

    it('encode and decode ID', () => {
        const buffer = new Nimiq.SerialBuffer(12);
        CookieJar.encodeId(DUMMY.id, buffer);
        buffer.reset();
        const id = CookieJar.decodeId(buffer);
        expect(id).toBe(DUMMY.id);
    });

    it('encode and decode type', () => {
        const buffer = new Nimiq.SerialBuffer(1);
        CookieJar.encodeType(DUMMY.type, buffer);
        expect(buffer.writePos).toBe(1);
        buffer.reset();
        const type = CookieJar.decodeType(buffer);
        expect(type).toBe(DUMMY.type);
    });

    it('encode and decode account', () => {
        const buffer = new Nimiq.SerialBuffer(200);
        CookieJar.encodeAccount(DUMMY_ACCOUNT, buffer);
        expect(buffer.writePos).toBeGreaterThan(20);
        buffer.reset();
        const account = CookieJar.decodeAccount(buffer);
        expect(account).toEqual(DUMMY_ACCOUNT);
    });

    it('encode and decode contract', () => {
        const buffer = new Nimiq.SerialBuffer(50);
        CookieJar.encodeContract(DUMMY_CONTRACT, buffer);
        expect(buffer.writePos).toBeGreaterThan(10);
        buffer.reset();
        const contract = CookieJar.decodeContract(buffer);
        expect(contract).toEqual(DUMMY_CONTRACT);
    });

    const makeWallets = (n: number): WalletInfoEntry[] => new Array(n).fill(DUMMIES).reduce((l, c) => l.concat(...c), []);
    it('Will fit one more, and will not', () => {
        for (let number = 10; number < 50; number += 1) {
            const wallets = makeWallets(number);
            const encoded = CookieJar.encode(wallets);
            const currentSize = Utf8Tools.stringToUtf8ByteArray(encoded).length;
            const avgSize = currentSize / wallets.length;
            const expectedSize = avgSize * (wallets.length + 2);
            const fits = expectedSize < CookieJar.COOKIE_SIZE;
            expect(CookieJar.willFitOneMore(wallets)).toBe(fits);
            if (!fits) {
                console.log(`${ number } wallets will fit`);
                break;
            }
        }
    });

    it('Will not fit', () => {
        expect(CookieJar.willFit(makeWallets(1000))).toBe(false);
    });

    it('Encode and decode reproduce source', () => {
        const encoded = CookieJar.encodeWallets(DUMMIES);
        console.log(`Serialized size: ${ encoded.length }`)
        // 215 for CookieJar 1
        // 195 for CookieJar 2 :)
        expect(encoded.length).toBeGreaterThan(100);
        const decoded = CookieJar.decodeWallets(encoded);
        expect(decoded).toEqual(DUMMIES);
    });

    it('Deal with no cookie', () => {
        document.cookie = '';
        const wallets = CookieJar.eat();
        expect(wallets).toHaveLength(0);
    });
});
