import { RpcServer } from '@nimiq/rpc';
import { BrowserDetection } from '@nimiq/utils';
import { WalletStore } from '@/lib/WalletStore';
import { WalletInfoEntry, WalletInfo } from '@/lib/WalletInfo';
import { CookieJar } from '@/lib/CookieJar';
import { KeyguardClient } from '@nimiq/keyguard-client';

class IFrameApi {
    public static run() {
        const rpcServer = new RpcServer(IFrameApi.allowedOrigin);

        // Register handlers
        rpcServer.onRequest('list', IFrameApi.list);

        rpcServer.init();
    }

    public static async list(): Promise<WalletInfoEntry[]> {
        let wallets: WalletInfoEntry[];
        if (BrowserDetection.isIOS() || BrowserDetection.isSafari()) {
            wallets = CookieJar.eat();
        } else {
            wallets = await WalletStore.Instance.list();
        }
        if (wallets.length > 0) {
            return wallets;
        }

        // If no wallets exist, see if the Keyguard has keys
        const client = new KeyguardClient();
        const hasKeys = await client.hasKeys();
        if (hasKeys) {
            throw new Error('WALLETS_LOST');
        }

        // If no keys exist, check legacy accounts
        const hasLegacyKeys = await client.hasKeys(true);
        if (hasLegacyKeys) {
            throw new Error('MIGRATION_REQUIRED');
        }

        return [];
    }

    private static get allowedOrigin(): string {
        switch (window.location.origin) {
            case 'https://accounts.nimiq.com': return 'https://safe-next.nimiq.com';
            case 'https://accounts.nimiq-testnet.com': return 'https://safe-next.nimiq-testnet.com';
            default: return '*';
        }
    }
}

IFrameApi.run();
