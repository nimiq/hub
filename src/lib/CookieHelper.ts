// tslint:disable no-bitwise no-shadowed-variable

import { WalletInfoEntry, WalletType } from './WalletInfo';
import CookieJar from './CookieJar';
import { WalletStore } from './WalletStore';

export default class CookieHelper {
    public static readonly MAX_COOKIE_SIZE_KEYGUARD = 4000; // byte
    public static readonly KEYGUARD_COOKIE_SIZE = 46;

    public static async canFitNewWallets(wallets?: WalletInfoEntry[]): Promise<boolean> {
        return CookieJar.canFitNewWallets(wallets) && await CookieHelper._canKeyguardCookieFitNewKey();
    }

    private static async _canKeyguardCookieFitNewKey() {
        const wallets = await WalletStore.Instance.list();
        const nonLedgerWallets = wallets.filter((wallet) => wallet.type !== WalletType.LEDGER);
        const cookieSize = (nonLedgerWallets.length + 1) * this.KEYGUARD_COOKIE_SIZE;
        return cookieSize <= this.MAX_COOKIE_SIZE_KEYGUARD;
    }
}
