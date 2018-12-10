import Config from '@/lib/Config';

export default class LazyLoading {
    public static async loadScript(src: string, retainOrder: boolean = false) {
        let request = LazyLoading._requests.get(src);
        if (request) return request;
        request = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            LazyLoading._bindEvents(script, resolve, reject);
            script.type = 'text/javascript';
            script.src = src;
            if (retainOrder) {
                script.async = false; // download async and don't block rendering but execute in insertion order
            }
            document.head!.appendChild(script);
        });
        LazyLoading._requests.set(src, request);
        request.catch(() => LazyLoading._requests.delete(src));
        return request;
    }

    public static async loadScripts(srcs: string[], retainOrder?: boolean) {
        retainOrder = typeof retainOrder === 'undefined' ? retainOrder : srcs.length > 1;
        return Promise.all(srcs.map((src) => LazyLoading.loadScript(src, retainOrder)));
    }

    public static async loadStyle(href: string) {
        let request = LazyLoading._requests.get(href);
        if (request) return request;
        request = new Promise((resolve, reject) => {
            const link = document.createElement('link');
            LazyLoading._bindEvents(link, resolve, reject);
            link.rel = 'stylesheet';
            link.href = href;
            document.body.appendChild(link);
        });
        LazyLoading._requests.set(href, request);
        request.catch(() => LazyLoading._requests.delete(href));
        return request;
    }

    public static async loadNimiq(loadWasm = false): Promise<void> {
        let nimiqRequest = LazyLoading._requests.get('nimiq');
        if (!nimiqRequest) {
            if (typeof Nimiq === 'undefined') {
                const src = Config.cdn.replace('nimiq.js', 'web-offline.js');
                nimiqRequest = LazyLoading.loadScript(src);
            } else {
                nimiqRequest = Promise.resolve();
            }
            nimiqRequest = nimiqRequest.then(() => {
                let genesisConfigInitialized = true;
                try {
                    Nimiq.GenesisConfig.NETWORK_ID; // tslint:disable-line:no-unused-expression
                } catch (e) {
                    genesisConfigInitialized = false;
                }
                if (!genesisConfigInitialized) {
                    Nimiq.GenesisConfig[Config.network]();
                }
            });
            LazyLoading._requests.set('nimiq', nimiqRequest);
            nimiqRequest.catch(() => LazyLoading._requests.delete('nimiq'));
        }
        if (!loadWasm) return nimiqRequest;

        let wasmRequest = LazyLoading._requests.get('wasm');
        if (!wasmRequest) {
            wasmRequest = nimiqRequest.then(() => Nimiq.WasmHelper.doImportBrowser());
            LazyLoading._requests.set('nimiq-wasm', wasmRequest);
            wasmRequest.catch(() => LazyLoading._requests.delete('nimiq-wasm'));
        }
        return wasmRequest;
    }

    private static readonly _requests: Map<string, Promise<void>> = new Map<string, Promise<void>>();

    private static _bindEvents(el: HTMLElement, resolve: () => void, reject: (error: any) => void) {
        el.onload = () => {
            delete el.onload;
            delete el.onerror;
            resolve();
        };
        el.onerror = (e) => {
            delete el.onload;
            delete el.onerror;
            reject(e);
        };
    }
}
