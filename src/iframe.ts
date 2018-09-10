import { RpcServer } from '@nimiq/rpc';
import { KeyStore } from '@/lib/KeyStore';
import { KeyInfoEntry, KeyInfo } from '@/lib/KeyInfo';

class IFrameApi {
    public static run() {
        const rpcServer = new RpcServer('*');

        // Register handlers
        rpcServer.onRequest('list', IFrameApi.list);

        rpcServer.init();
    }

    public static async list(): Promise<KeyInfoEntry[]> {
        // if (BrowserDetection.isIos() || BrowserDetection.isSafari()) {
        //     return CookieJar.eat(listFromLegacyStore);
        // }

        return await KeyStore.Instance.list();
    }
}

IFrameApi.run();
