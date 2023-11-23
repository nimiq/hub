export function hexToBytes(hex: string) {
    return new Uint8Array((hex.match(/.{2}/g) || []).map((byte) => parseInt(byte, 16)));
}

export function bytesToHex(bytes: Uint8Array) {
    const HEX_ALPHABET = '0123456789abcdef';

    let hex = '';
    for (const code of bytes) {
        // tslint:disable:no-bitwise
        hex += HEX_ALPHABET[code >>> 4];
        hex += HEX_ALPHABET[code & 0x0F];
    }
    return hex;
}
