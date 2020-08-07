/* tslint:disable:no-bitwise */

// Adapted from https://github.com/45678/Base58

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function encodeBase58(bytes: number[] | Uint8Array): string {
    if (bytes.length === 0) {
        return '';
    }
    const digits = [0];
    let i = 0;
    while (i < bytes.length) {
        let j = 0;
        while (j < digits.length) {
            digits[j] <<= 8;
            j++;
        }
        digits[0] += bytes[i];
        let carry = 0;
        j = 0;
        while (j < digits.length) {
            digits[j] += carry;
            carry = (digits[j] / 58) | 0;
            digits[j] %= 58;
            ++j;
        }
        while (carry) {
            digits.push(carry % 58);
            carry = (carry / 58) | 0;
        }
        i++;
    }
    i = 0;
    while (bytes[i] === 0 && i < bytes.length - 1) {
        digits.push(0);
        i++;
    }
    return digits.reverse().map((digit) => ALPHABET[digit]).join('');
}

export function decodeBase58(text: string): number[] {
    const ALPHABET_MAP: {[letter: string]: number} = {};
    for (let n = 0; n < ALPHABET.length; n++) {
        ALPHABET_MAP[ALPHABET.charAt(n)] = n;
    }

    if (text.length === 0) {
        return [];
    }
    const bytes = [0];
    let i = 0;
    while (i < text.length) {
        const c = text[i];
        if (!(c in ALPHABET_MAP)) {
            throw new Error('Base58.decode received unacceptable input. Character \'' + c + '\' is not in the Base58 alphabet.');
        }
        let j = 0;
        while (j < bytes.length) {
            bytes[j] *= 58;
            j++;
        }
        bytes[0] += ALPHABET_MAP[c];
        let carry = 0;
        j = 0;
        while (j < bytes.length) {
            bytes[j] += carry;
            carry = bytes[j] >> 8;
            bytes[j] &= 0xff;
            ++j;
        }
        while (carry) {
            bytes.push(carry & 0xff);
            carry >>= 8;
        }
        i++;
    }
    i = 0;
    while (text[i] === '1' && i < text.length - 1) {
        bytes.push(0);
        i++;
    }
    return bytes.reverse();
}
