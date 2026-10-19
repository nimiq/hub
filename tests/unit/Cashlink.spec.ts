import { setup } from './_setup';
import Cashlink from '@/lib/Cashlink';
import { CashlinkCurrency, CashlinkTheme } from '../../client/PublicRequestTypes';

setup();

const SECRET = new Uint8Array([
    70, 207, 252, 77, 192, 84, 237, 202, 3, 46, 88, 64, 101, 200, 131, 19, 212,
    105, 128, 49, 54, 99, 159, 166, 103, 196, 208, 178, 26, 244, 184, 234,
]);
const ADDRESS = 'NQ73 822X Q55C EQ9N BV36 DD59 TMED X511 TQAY';
const VALUE = 1234554321;
const MESSAGE = 'Ein Cashlink test Cashlink';

// Encodes a link as Cashlink.render would, but with any currency byte, and optionally with excess data after it.
function renderLink(currencyByte: number, excessData = new Uint8Array(0)): string {
    const buf = new Nimiq.SerialBuffer(Cashlink.SECRET_SIZE + /*value*/ 8 + /*message length*/ 1 + /*theme*/ 1
        + /*currency*/ 1 + excessData.byteLength);
    buf.write(SECRET);
    buf.writeUint64(VALUE);
    buf.writeUint8(/*message length*/ 0);
    buf.writeUint8(CashlinkTheme.UNSPECIFIED);
    buf.writeUint8(currencyByte);
    buf.write(excessData);
    return Nimiq.BufferUtils.toBase64Url(buf).replace(/\./g, '=');
}

describe('Cashlink', () => {
    it('can be restored from legacy entries, which encode the key pair', () => {
        const legacyEntry = {
            keyPair: Nimiq.KeyPair.derive(new Nimiq.PrivateKey(SECRET)).serialize(),
            address: ADDRESS,
            value: VALUE,
            message: MESSAGE,
            state: 2, // legacy entries also contain the Cashlink state, here UNCLAIMED
            theme: CashlinkTheme.BIRTHDAY,
            timestamp: 1600000000,
        };
        const cashlink = Cashlink.fromObject(legacyEntry);
        expect(cashlink.currency).toBe(CashlinkCurrency.NIM);
        // When stored again, it's converted to the current format.
        expect(cashlink.toObject(/*includeOptional*/ false)).toEqual({
            secret: SECRET,
            address: ADDRESS,
            value: VALUE,
            message: MESSAGE,
            theme: CashlinkTheme.BIRTHDAY,
            timestamp: 1600000000,
        });
    });

    it('can be rendered as a link and be parsed from it', () => {
        const optionalData: Array<[/*message*/ string, /*theme*/ CashlinkTheme | undefined]> = [
            ['', undefined],
            [MESSAGE, undefined],
            ['', CashlinkTheme.CHRISTMAS],
            [MESSAGE, CashlinkTheme.CHRISTMAS],
        ];
        for (const [message, theme] of optionalData) {
            const cashlink = new Cashlink(CashlinkCurrency.NIM, SECRET, ADDRESS, VALUE, undefined, message, theme);
            expect(Cashlink.parse(cashlink.render())).toMatchObject({
                currency: CashlinkCurrency.NIM,
                secret: SECRET,
                address: ADDRESS,
                value: VALUE,
                message,
                hasEncodedTheme: !!theme,
                theme: theme || Cashlink.DEFAULT_THEME,
            });
        }
    });

    it('accepts links which explicitly specify the default currency', () => {
        expect(Cashlink.parse(renderLink(/*NIM*/ 0))).toMatchObject({
            currency: CashlinkCurrency.NIM,
            secret: SECRET,
            address: ADDRESS,
            value: VALUE,
        });
    });

    it('rejects links of unsupported currencies', () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        expect(Cashlink.parse(renderLink(255))).toBeNull();
        consoleError.mockRestore();
    });

    it('rejects links with excess data', () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        expect(Cashlink.parse(renderLink(/*NIM*/ 0, new Uint8Array([0])))).toBeNull();
        consoleError.mockRestore();
    });
});
