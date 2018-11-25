import { RpcServer } from '@nimiq/rpc';
import { BrowserDetection } from '@nimiq/utils';
import { WalletStore } from '@/lib/WalletStore';
import { WalletInfoEntry } from '@/lib/WalletInfo';

class IFrameApi {
    public static run() {
        const rpcServer = new RpcServer(IFrameApi.allowedOrigin);

        // Register handlers
        rpcServer.onRequest('list', IFrameApi.list);

        rpcServer.init();
    }

    public static async list(): Promise<WalletInfoEntry[]> {
        if (BrowserDetection.isIos() || BrowserDetection.isSafari()) {
            // case 1: cookie exists
            return CookieJar.eat();
            // case 2: no cookie yet, because we have to migrate first?
        }

        return await WalletStore.Instance.list();
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
