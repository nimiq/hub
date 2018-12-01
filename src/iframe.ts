import { RpcServer } from '@nimiq/rpc';
import { BrowserDetection } from '@nimiq/utils';
import { WalletStore } from '@/lib/WalletStore';
import { WalletInfoEntry } from '@/lib/WalletInfo';
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

        // If no wallets exist, see if the Keyguard has keys
        if (wallets.length === 0) {
            let keys: KeyguardRequest.KeyInfoObject[];
            const client = new KeyguardClient();
            keys = await client.list();

            // If no keys exist, check legacy accounts and migrate
            if (keys.length === 0) {
                keys = await client.list(true);
            }

            // TODO Store wallets and trigger migration in Keyguard
        }

        return wallets;
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
