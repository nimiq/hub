import { WalletInfo, WalletType } from '@/lib/WalletInfo';
import { AccountInfo } from '@/lib/AccountInfo';
import { ContractType } from '@/lib/ContractInfo';
import { CookieJar } from '@/lib/CookieJar2';

const Nimiq = require('@nimiq/core'); // tslint:disable-line:no-var-requires variable-name
// @ts-ignore
global.Nimiq = Nimiq;

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

const beforeEachCallback = async () => {
};

const afterEachCallback = async () => {
};

describe('CookieJar', () => {

    beforeEach(beforeEachCallback);

    afterEach(afterEachCallback);

    it('test base64 in and out', () => {
        // const data = 'asdfghjkl][p;.,345678äöäöäö我';
        const data = '我asdf';
        let inBuffer = new Nimiq.SerialBuffer(data.length*2);
        inBuffer.writeVarLengthString(data);
        console.log(inBuffer);
        const inArray = new Uint8Array(inBuffer.subarray(0, inBuffer.writePos));
        console.log(inArray.join(','));
        const base64 = CookieJar.base64Encode(inArray);
        console.log(base64);
        const outArray = CookieJar.base64Decode(base64);
        console.log(inArray.join(','));
        console.log(outArray.join(','));
        // expect(outArray).toContain(inArray);
        // expect(inArray).toEqual(outArray);
        console.log(outArray);
        const outBuffer = new Nimiq.SerialBuffer(outArray);
        console.log(outBuffer);
        const result = outBuffer.readVarLengthString();
        expect(result).toBe(data);
    });
    // it('fill sets cookie', () => {
    //     CookieJar.fill(DUMMIES);
    //     const cookie = document.cookie;
    //     expect(cookie).not.toBeNull();
    //     expect(cookie.length).toBeGreaterThan(DUMMIES.length*50);
    //     expect(cookie).toBe(CookieJar.encodeWallets(DUMMIES));
    //     console.log(cookie);
    // });

    // it('fill produces same string', () => {
    //     CookieJar.fill(DUMMIES);
    //     const first = document.cookie;
    //     CookieJar.fill(DUMMIES);
    //     const second = document.cookie;
    //     expect(first).toBe(second);
    //     console.log(first.length, first);
    // });

    // it('encode and decode base 64', () => {
    //     const test = Uint8Array.from(<number[]> 'tes'.split('').map(character => character.codePointAt(0)));
    //     const encoded = CookieJar.base64Encode(test);
    //     const decoded = CookieJar.base64Decode(encoded);
    //     expect(decoded).toEqual(test);
    // });

    it('encode and decode address', () => {
        const address = DUMMY.accounts.values().next().value.address;
        console.log(Array.from(address.values()).map(b => b.toString(2)).join(','));
        const buffer = new Nimiq.SerialBuffer(20);
        CookieJar.encodeAddress(address, buffer);
        console.log(buffer);
        const decoded = CookieJar.decodeAddress(buffer);
        console.log(Array.from(decoded.values()).map(b => b.toString(2)).join(','));
        expect(decoded).toEqual(address);
    });

    // it('encode and decode ID', () => {
    //     expect(DUMMY.id).toBe(CookieJar.decodeId(CookieJar.encodeId(DUMMY.id)));
    //     console.log(CookieJar.encodeId(DUMMY.id));
    // });

    // it('encode and decode type', () => {
    //     const type = CookieJar.encodeType(DUMMY.type);
    //     expect(type).toHaveLength(1);
    //     expect(CookieJar.decodeType(type)).toBe(DUMMY.type);
    // });

    it('Encode and decode reproduce source', () => {
        const encoded = CookieJar.encodeWallets(DUMMIES);
        // https://stackoverflow.com/questions/2219526/how-many-bytes-in-a-javascript-string
        console.log(`Serialized size: ${ encodeURI(encoded).split(/%(?:u[0-9A-F]{2})?[0-9A-F]{2}|./).length -1 }`)
        // 215 for CookieJar 1
        console.log(encoded);
        expect(encoded.length).toBeGreaterThan(100);
        expect(CookieJar.decodeWallets(encoded)).toEqual(DUMMIES);
    });
});
