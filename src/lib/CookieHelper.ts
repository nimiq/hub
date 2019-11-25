// tslint:disable no-bitwise no-shadowed-variable

import { WalletInfoEntry, WalletType } from './WalletInfo';
import CookieJar from './CookieJar';
import { WalletStore } from './WalletStore';

export default class CookieHelper {
    public static readonly MAX_COOKIE_SIZE_KEYGUARD = 4000; // byte
    public static readonly KEYGUARD_COOKIE_KEY_SIZE = 47; // 1 char for type, 1 for hasPin, 44 for id, 1 for separator

    public static async canFitNewWallets(wallets?: WalletInfoEntry[]): Promise<boolean> {
        const [canHubCookieFitNewWallets, canKeyguardCookieFitNewWallets] = await Promise.all([
            CookieJar.canFitNewWallets(wallets),
            CookieHelper._canKeyguardCookieFitNewKey(),
        ]);
        return canHubCookieFitNewWallets && canKeyguardCookieFitNewWallets;
    }

    private static async _canKeyguardCookieFitNewKey() {
        const wallets = await WalletStore.Instance.list();
        const nonLedgerWallets = wallets.filter((wallet) => wallet.type !== WalletType.LEDGER);
        const cookieSize = (nonLedgerWallets.length + 1) * this.KEYGUARD_COOKIE_KEY_SIZE;
        return cookieSize <= this.MAX_COOKIE_SIZE_KEYGUARD;
    }
}
