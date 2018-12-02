// tslint:disable no-bitwise no-shadowed-variable

import { WalletInfoEntry, WalletType } from './WalletInfo';
import { Utf8Tools } from '@nimiq/utils';

export default class CookieJar {
    public static readonly VERSION = 1;

    public static fill(wallets: WalletInfoEntry[]) {
        const maxAge = 60 * 60 * 24 * 365;
        const encodedWallets = this.encodeCookie(wallets);
        document.cookie = `w=${encodedWallets};max-age=${maxAge.toString()}`;
    }

    public static async eat(): Promise<WalletInfoEntry[]> {
        const match = document.cookie.match(new RegExp('w=([^;]+)'));
        if (match && match[1]) {
            return this.decodeCookie(match[1]);
        }
        return [];
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

                const labelBytes = Utf8Tools.stringToUtf8ByteArray(account.label);

                // Combined account label length & wallet type
                bytes.push(labelBytes.length << 2); // type is LEGACY = 0, thus 0b00 anyway;

                // Account label
                if (labelBytes.length > 0) bytes.push.apply(bytes, Array.from(labelBytes));

                // Account address
                bytes.push.apply(bytes, Array.from(account.address));
                continue;
            }

            // Handle regular wallet

            const labelBytes = Utf8Tools.stringToUtf8ByteArray(wallet.label);

            // Combined wallet label length & wallet type
            bytes.push( (labelBytes.length << 2) | wallet.type);

            // Wallet label
            if (labelBytes.length > 0) bytes.push.apply(bytes, Array.from(labelBytes));

            // Wallet number of accounts
            bytes.push(wallet.accounts.size);

            // Wallet accounts
            const accounts = Array.from(wallet.accounts.values());
            for (const account of accounts) {
                const labelBytes = Utf8Tools.stringToUtf8ByteArray(account.label);

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
}
