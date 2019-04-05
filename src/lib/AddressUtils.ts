// tslint:disable no-bitwise

export default class AddressUtils {
    // The following methods are taken from @nimiq/core source,
    // namely Nimiq.Address and Nimiq.BufferUtils.

    public static toUserFriendlyAddress(serializedAddress: Uint8Array, withSpaces = true): string {
        const base32 = this._toBase32(serializedAddress);
        // tslint:disable-next-line prefer-template
        const check = ('00' + (98 - this._ibanCheck(base32 + this.CCODE + '00'))).slice(-2);
        let res = this.CCODE + check + base32;
        if (withSpaces) res = res.replace(/.{4}/g, '$& ').trim();
        return res;
    }

    private static CCODE = 'NQ';
    private static BASE32_ALPHABET_NIMIQ = '0123456789ABCDEFGHJKLMNPQRSTUVXY';

    private static _ibanCheck(str: string): number {
        const num = str.split('').map((c) => {
            const code = c.toUpperCase().charCodeAt(0);
            return code >= 48 && code <= 57 ? c : (code - 55).toString();
        }).join('');
        let tmp = '';

        for (let i = 0; i < Math.ceil(num.length / 6); i++) {
            tmp = (parseInt(tmp + num.substr(i * 6, 6), 10) % 97).toString();
        }

        return parseInt(tmp, 10);
    }

    private static _toBase32(buf: Uint8Array, alphabet = this.BASE32_ALPHABET_NIMIQ): string {
        let shift = 3;
        let carry = 0;
        let symbol: number;
        let res = '';

        for (const byte of buf) {
            symbol = carry | (byte >> shift);
            res += alphabet[symbol & 0x1f];

            if (shift > 5) {
                shift -= 5;
                symbol = byte >> shift;
                res += alphabet[symbol & 0x1f];
            }

            shift = 5 - shift;
            carry = byte << shift;
            shift = 8 - shift;
        }

        if (shift !== 3) {
            res += alphabet[carry & 0x1f];
        }

        while (res.length % 8 !== 0 && alphabet.length === 33) {
            res += alphabet[32];
        }

        return res;
    }
}
