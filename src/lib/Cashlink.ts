import { Utf8Tools } from '@nimiq/utils';
import { CashlinkCurrency, CashlinkTheme } from '../../client/PublicRequestTypes';

export type CashlinkEntry = {
    address: string;
    value: number;
    fee?: number;
    message: string;
    timestamp: number;
    theme?: CashlinkTheme;
} & ({
    // Legacy cashlink entries encode the keyPair
    keyPair: Uint8Array;
} | {
    currency?: CashlinkCurrency; // Only set for currencies other than NIM, unless specifically requested for NIM, too.
    // Newer cashlink entries only encode the private key anymore to save space and be generic to different kinds of
    // private keys.
    secret: Uint8Array;
});

class Cashlink<C extends CashlinkCurrency = CashlinkCurrency> {
    get value() {
        return this._value || 0;
    }

    set value(value: number) {
        if (this._value && this.isImmutable) {
            throw new Error('Cannot set value, Cashlink is immutable');
        }
        if (!Nimiq.NumberUtils.isUint64(value) || value === 0) throw new Error('Malformed Cashlink value');
        this._value = value;
    }

    get fee() {
        return this._fee || 0;
    }

    set fee(fee: number) {
        this._fee = fee;
        // TODO emit an event on fee change
    }

    get message() {
        return Utf8Tools.utf8ByteArrayToString(this._messageBytes);
    }

    set message(message: string) {
        if (this._messageBytes.byteLength && this.isImmutable) {
            throw new Error('Cannot set message, Cashlink is immutable');
        }
        const messageBytes = Utf8Tools.stringToUtf8ByteArray(message);
        if (!Nimiq.NumberUtils.isUint8(messageBytes.byteLength)) throw new Error('Cashlink message is too long');
        this._messageBytes = messageBytes;
    }

    get theme() {
        return this._theme || Cashlink.DEFAULT_THEME;
    }

    set theme(theme: CashlinkTheme) {
        if (this._theme && this.isImmutable) {
            throw new Error('Cannot set theme, Cashlink is immutable');
        }
        if (!Nimiq.NumberUtils.isUint8(theme)) {
            throw new Error('Invalid Cashlink theme');
        }
        this._theme = !Object.values(CashlinkTheme).includes(theme)
            ? CashlinkTheme.UNSPECIFIED // lenient fallback
            : theme;
    }

    get hasEncodedTheme() {
        return !!this._theme;
    }

    get isImmutable() {
        // Intended to be overridable by child classes with additional conditions.
        return this._immutable;
    }

    public static async create<C extends CashlinkCurrency = CashlinkCurrency.NIM>(
        currency: C = CashlinkCurrency.NIM as C,
    ): Promise<Cashlink<C>> {
        const secret = new Uint8Array(Cashlink.SECRET_SIZE);
        window.crypto.getRandomValues(secret);
        const address = await Cashlink._deriveAddress(currency, secret);
        return new Cashlink(currency, secret, address);
    }

    public static async parse(str: string): Promise<Cashlink | null> {
        if (!str) return null;
        try {
            str = str.replace(/~/g, '').replace(/=*$/, (match) => new Array(match.length).fill('.').join(''));
            const buf = Nimiq.BufferUtils.fromBase64Url(str);
            const secret = buf.read(Cashlink.SECRET_SIZE);
            const value = buf.readUint64();
            let message: string = '';
            if (buf.readPos < buf.byteLength) {
                const messageLength = buf.readUint8();
                const messageBytes = buf.read(messageLength);
                message = Utf8Tools.utf8ByteArrayToString(messageBytes);
            }
            let theme: CashlinkTheme | undefined;
            if (buf.readPos < buf.byteLength) {
                theme = buf.readUint8();
                // Do not validate theme as Cashlinks are allowed to specify themes which are not supported anymore.
            }
            let currency: CashlinkCurrency = CashlinkCurrency.NIM;
            if (buf.readPos < buf.byteLength) {
                currency = buf.readUint8();
                if (!CashlinkCurrency[currency]) {
                    throw new Error(`Unsupported Cashlink currency ${currency}`);
                }
            }

            const address = await Cashlink._deriveAddress(currency, secret);
            return new Cashlink(
                currency,
                secret,
                address,
                value,
                undefined, // fee
                message,
                theme,
            );
        } catch (e) {
            console.error('Error parsing Cashlink:', e);
            return null;
        }
    }

    public static fromObject(object: CashlinkEntry): Cashlink {
        return new Cashlink(
            'currency' in object && object.currency !== undefined ? object.currency : CashlinkCurrency.NIM,
            'keyPair' in object
                // Legacy Cashlink entry encoding a Nimiq key pair.
                ? Nimiq.KeyPair.deserialize(object.keyPair).privateKey.serialize()
                : object.secret,
            object.address,
            object.value,
            object.fee,
            object.message,
            object.theme,
            // @ts-ignore `timestamp` was called `date` before and was live in the mainnet.
            object.timestamp || object.date,
        );
    }

    private static async _deriveAddress(currency: CashlinkCurrency, secret: Uint8Array): Promise<string> {
        switch (currency) {
            case CashlinkCurrency.NIM: {
                const privateKey = Nimiq.PrivateKey.deserialize(secret);
                const publicKey = Nimiq.PublicKey.derive(privateKey);
                return publicKey.toAddress().toUserFriendlyAddress();
            }
            case CashlinkCurrency.USDT: {
                const ethers = await import(/* webpackChunkName: "ethers-js" */ 'ethers');
                const mnemonic = Nimiq.MnemonicUtils.entropyToMnemonic(secret);
                const polygonWallet = ethers.Wallet.fromMnemonic(mnemonic.join(' '), 'm');
                return polygonWallet.address;
            }
            default:
                const _exhaustiveCheck: never = currency; // Check to notice unsupported currency at compilation time.
                return _exhaustiveCheck;
        }
    }

    private _value: number | null = null; // amount in the smallest unit of the Cashlink's currency
    private _fee: number | null = null; // fee in the smallest unit of the Cashlink's currency
    private _messageBytes: Uint8Array = new Uint8Array(0);
    private _theme: CashlinkTheme = CashlinkTheme.UNSPECIFIED; // note that UNSPECIFIED equals to 0 and is thus falsy
    private readonly _immutable: boolean;

    constructor(
        public readonly currency: C,
        public secret: Uint8Array,
        public address: string,
        value?: number,
        fee?: number,
        message?: string,
        theme?: CashlinkTheme,
        public timestamp: number = Math.floor(Date.now() / 1000),
    ) {
        if (this.secret.byteLength !== Cashlink.SECRET_SIZE) throw new Error('Invalid Cashlink secret');

        if (value) this.value = value;
        if (fee) this.fee = fee;
        if (message) this.message = message;
        if (theme) this.theme = theme;

        this._immutable = !!(value || message || theme);
    }

    public toObject(includeOptional: boolean = true): CashlinkEntry {
        const result: CashlinkEntry = {
            secret: this.secret,
            address: this.address,
            value: this.value,
            message: this.message,
            theme: this._theme,
            timestamp: this.timestamp,
        };
        if (this.currency !== CashlinkCurrency.NIM) {
            // Only currencies different to NIM, which is the default, have to be specified.
            result.currency = this.currency;
        }
        if (includeOptional) {
            result.currency = this.currency; // include currency even for NIM, which is optional
            if (this._fee !== null) {
                result.fee = this._fee;
            }
        }
        return result;
    }

    public render() {
        // TODO when switching to Cashlinks on cash.link, also change the format of the Cashlinks:
        //  - add a version byte as first byte, which would then allow for breaking changes of the encoding scheme and
        //    could potentially already encode which optional parameters are set in a more efficient manner.
        //  - as we probably won't really need the 8 available bytes for the amount, it can also be considered encoding
        //    the version there.
        //  - order optional values by likelyhood that they are set, because in the current encoding scheme, prior
        //    optional values have to also be encoded if a following optional value is set.
        //  - consider making the currency required?

        // If a subsequent optional parameter has to be encoded, all prior optional parameters have to be encoded as
        // well for deterministic parsing. For example, if the currency has to be encoded, the theme and message
        // (length) have to be encoded as well.
        const hasToEncodeCurrency = this.currency !== CashlinkCurrency.NIM;
        const hasToEncodeTheme = !!this._theme || hasToEncodeCurrency;
        const hasToEncodeMessage = !!this._messageBytes.byteLength || hasToEncodeTheme;

        const buf = new Nimiq.SerialBuffer(
            /*key*/ Cashlink.SECRET_SIZE +
            /*value*/ 8 +
            // optional parameters
            /*message*/ (hasToEncodeMessage ? /*length*/ 1 + /*message bytes*/ this._messageBytes.byteLength : 0) +
            /*theme*/ (hasToEncodeTheme ? 1 : 0) +
            /*currency*/ (hasToEncodeCurrency ? 1 : 0),
        );

        buf.write(this.secret);
        buf.writeUint64(this.value);
        if (hasToEncodeMessage) {
            buf.writeUint8(this._messageBytes.byteLength);
            buf.write(this._messageBytes);
        }
        if (hasToEncodeTheme) {
            buf.writeUint8(this._theme);
        }
        if (hasToEncodeCurrency) {
            buf.writeUint8(this.currency);
        }

        let result = Nimiq.BufferUtils.toBase64Url(buf);
        // replace trailing . by = because of URL parsing issues on iPhone.
        result = result.replace(/\./g, '=');
        // iPhone also has a problem to parse long words with more then 300 chars in a URL in WhatsApp
        // (and possibly others). Therefore we break the words by adding a ~ every 256 characters in long words.
        result = result.replace(/[A-Za-z0-9_]{257,}/g, (match) => match.replace(/.{256}/g, '$&~'));

        return result;
    }
}

namespace Cashlink {
    export const SECRET_SIZE = 32;
    // To be updated with the seasons.
    export const DEFAULT_THEME = Date.now() < new Date('Tue, 13 Apr 2020 23:59:00 GMT-12').valueOf()
        ? CashlinkTheme.EASTER
        : CashlinkTheme.STANDARD;
}

export default Cashlink;
