import { RpcServer } from '@nimiq/rpc';
import { BrowserDetection } from '@nimiq/utils';
import { WalletStore } from '@/lib/WalletStore';
import { WalletInfoEntry, WalletInfo } from '@/lib/WalletInfo';
import CookieJar from '@/lib/CookieJar';
import Config from 'config';
import { Account, Cashlink } from './lib/PublicRequestTypes';
import { CashlinkStore } from './lib/CashlinkStore';
import { CashlinkType } from './lib/Cashlink';

class IFrameApi {
    public static run() {
        const rpcServer = new RpcServer(Config.privilegedOrigins);

        // Register handlers
        rpcServer.onRequest('list', IFrameApi.list);
        rpcServer.onRequest('list-cashlinks', IFrameApi.cashlinks);

        rpcServer.init();
    }

    public static async list(): Promise<Account[]> {
        let wallets: WalletInfoEntry[];
        if (BrowserDetection.isIOS() || BrowserDetection.isSafari()) {
            wallets = await CookieJar.eat();
        } else {
            wallets = await WalletStore.Instance.list();
        }
        if (wallets.length > 0) {
            return wallets
                .filter((wallet) => !wallet.keyMissing)
                .map((wallet) => WalletInfo.objectToAccountType(wallet));
        }

        // If no wallets exist, see if the Keyguard has keys
        const client = new (await import('@nimiq/keyguard-client')).KeyguardClient(Config.keyguardEndpoint);
        const hasKeys = await client.hasKeys();
        if (hasKeys.success) {
            throw new Error('ACCOUNTS_LOST');
        }

        // If no keys exist, check for legacy accounts
        const hasLegacyAccounts = await client.hasLegacyAccounts();
        if (hasLegacyAccounts.success) {
            throw new Error('MIGRATION_REQUIRED');
        }

        return [];
    }

    public static async cashlinks(): Promise<Cashlink[]> {
        const cashlinks = await CashlinkStore.Instance.list();
        return cashlinks.map((cashlink) => ({
            address: cashlink.address,
            message: cashlink.message,
            status: cashlink.state,
            sender: cashlink.originalSender!,
            recipient: cashlink.finalRecipient,
        }));
    }
}

IFrameApi.run();
