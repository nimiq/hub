// tslint:disable no-bitwise no-shadowed-variable

import { WalletInfoEntry, WalletType } from './WalletInfo';
import { Utf8Tools } from '@nimiq/utils';

export default class CookieJar {
    public static readonly VERSION = 1;
    public static readonly MAX_COOKIE_SIZE = 2500; // byte (3000 would propable be safe, but we'll be safer for now)
    public static readonly MAX_LABEL_LENGTH = 63;

    public static readonly ENCODED_ACCOUNT_SIZE =
           1 // account label length
        + 63 // account label
        + 20 // address
    ;
    public static readonly ENCODED_WALLET_SIZE =
           6 // wallet ID
        +  1 // wallet type and label length
        + 63 // wallet label
        +  1 // number of accounts
        +  CookieJar.ENCODED_ACCOUNT_SIZE
    ;

    public static fill(wallets: WalletInfoEntry[]) {
        const maxAge = 60 * 60 * 24 * 365; // 1 year
        const encodedWallets = this.encodeCookie(wallets);
        document.cookie = `w=${encodedWallets};max-age=${maxAge.toString()}`;
    }

    public static async eat(): Promise<WalletInfoEntry[]> {
        const encodedWallets = this._getCookieContents();
        return encodedWallets ? this.decodeCookie(encodedWallets) : [];
    }

    public static encodeCookie(wallets: WalletInfoEntry[]) {
        const bytes: number[] = [];

        // Cookie version
        bytes.push(CookieJar.VERSION);

        for (const wallet of wallets) {
            // Wallet ID
            const walletIdChunks = wallet.id.match(/.{2}/g);
            for (const chunk of walletIdChunks!) bytes.push(parseInt(chunk, 16));

            // Handle LEGACY wallet
            if (wallet.type === WalletType.LEGACY) {
                const account = wallet.accounts.values().next().value;

                const labelBytes = this.cutLabel(account.label);

                // Combined account label length & wallet type
                bytes.push(labelBytes.length << 2); // type is LEGACY = 0, thus 0b00 anyway;

                // Account label
                if (labelBytes.length > 0) bytes.push.apply(bytes, Array.from(labelBytes));

                // Account address
                bytes.push.apply(bytes, Array.from(account.address));
                continue;
            }

            // Handle regular wallet

            const labelBytes = this.cutLabel(wallet.label);

            // Combined wallet label length & wallet type
            bytes.push( (labelBytes.length << 2) | wallet.type);

            // Wallet label
            if (labelBytes.length > 0) bytes.push.apply(bytes, Array.from(labelBytes));

            // Wallet number of accounts
            bytes.push(wallet.accounts.size);

            // Wallet accounts
            const accounts = Array.from(wallet.accounts.values());
            for (const account of accounts) {
                const labelBytes = this.cutLabel(account.label);

                // Account label length
                bytes.push(labelBytes.length);

                // Account label
                if (labelBytes.length > 0) bytes.push.apply(bytes, Array.from(labelBytes));

                // Account address
                bytes.push.apply(bytes, Array.from(account.address));
            }
        }

        return Nimiq.BufferUtils.toBase64(new Uint8Array(bytes));
    }

    public static async decodeCookie(str: string): Promise<WalletInfoEntry[]> {
        const module = await import(/* webpackChunkName: "cookie-decoder" */ './CookieDecoder');
        return module.CookieDecoder.decode(str);
    }

    public static canFitNewAccount(): boolean {
        return (this.MAX_COOKIE_SIZE - this._getCookieSize()) >= this.ENCODED_ACCOUNT_SIZE;
    }

    public static canFitNewWallet(): boolean {
        return (this.MAX_COOKIE_SIZE - this._getCookieSize()) >= this.ENCODED_WALLET_SIZE;
    }

    public static cutLabel(label: string): Uint8Array {
        let labelBytes =  Utf8Tools.stringToUtf8ByteArray(label);

        if (labelBytes.length <= this.MAX_LABEL_LENGTH) return labelBytes;

        // Don't output warning in NodeJS environment (when running tests)
        if (typeof global === 'undefined') console.warn('Label will be shortened for cookie:', label);

        labelBytes = labelBytes.slice(0, this.MAX_LABEL_LENGTH);

        // Cut off last byte until byte array is valid utf-8
        while (!Utf8Tools.isValidUtf8(labelBytes)) labelBytes = labelBytes.slice(0, labelBytes.length - 1);
        return labelBytes;
    }

    private static _getCookieContents(): string | null {
        const match = document.cookie.match(new RegExp('w=([^;]+)'));
        return match && match[1];
    }

    private static _getCookieSize(): number {
        const encodedWallets = this._getCookieContents() || '';
        return Nimiq.BufferUtils.fromBase64(encodedWallets).length;
    }
}
