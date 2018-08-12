class Demo {
    constructor(keyguardBaseUrl) {
        this._iframeClient = null;
        this._keyguardBaseUrl = keyguardBaseUrl;
    }

    async setUp(keyPassphrase) {
        // Local setUp first
        const entropy = new Nimiq.Entropy(Nimiq.BufferUtils.fromHex(Demo.ENTROPY));

        const addresses = new Map();
        addresses.set(Demo.DEFAULT_PATH1, Demo._deriveAddressInfo(entropy, Demo.DEFAULT_PATH1));
        addresses.set(Demo.DEFAULT_PATH2, Demo._deriveAddressInfo(entropy, Demo.DEFAULT_PATH2));

        const keyInfo = {
            id: Demo._keyIdFromEntropy(entropy),
            label: 'KeyLabel',
            addresses,
            contracts: [],
            type: /*BIP39*/ 1,
        };

        const keyStore = new KeyStore();
        await keyStore.put(keyInfo);
        await keyStore.close();

        // Then remote setUp
        const keyguardSetup = await this.startIframeClient(this._keyguardBaseUrl);
        await keyguardSetup.call('setUp', keyPassphrase);
    }

    static _keyIdFromEntropy(entropy) {
        return Nimiq.BufferUtils.toHex(Nimiq.Hash.blake2b(entropy.serialize()).subarray(0, 6));
    }

    static _deriveAddressInfo(entropy, path) {
        return {
            path,
            label: 'Standard Account',
            address: Demo._deriveAddress(entropy, path).serialize()
        };
    }

    static _deriveAddress(entropy, path) {
        const privKey = entropy.toExtendedPrivateKey().derivePath(path).privateKey;
        const pubKey = Nimiq.PublicKey.derive(privKey);
        return pubKey.toAddress();
    }

    async tearDown() {
        // Local tearDown
        const entropy = new Nimiq.Entropy(Nimiq.BufferUtils.fromHex(Demo.ENTROPY));

        const keyStore = new KeyStore();
        await keyStore.remove(Demo._keyIdFromEntropy(entropy));
        await keyStore.close();

        // Then remote tearDown
        const keyguardSetup = await this.startIframeClient(this._keyguardBaseUrl);
        await keyguardSetup.call('tearDown');
    }

    async startIframeClient(baseUrl) {
        if (this._iframeClient) return this._iframeClient;
        const $iframe = await Demo._createIframe(baseUrl);
        if (!$iframe.contentWindow) throw new Error(`IFrame contentWindow is ${typeof $iframe.contentWindow}`);
        this._iframeClient = new Rpc.PostMessageRpcClient($iframe.contentWindow, '*');
        await this._iframeClient.init();
        return this._iframeClient;
    }

    static async _createIframe(baseUrl) {
        return new Promise((resolve, reject) => {
            const $iframe = document.createElement('iframe');
            $iframe.name = 'Nimiq Keyguard Setup IFrame';
            $iframe.style.display = 'none';
            document.body.appendChild($iframe);
            $iframe.src = `${baseUrl}/demos/setup.html`;
            $iframe.onload = () => resolve($iframe);
            $iframe.onerror = reject;
        });
    }
}
Demo.ENTROPY = 'abb107d2c9adafed0b2ff41c0cfbe4ad4352b11362c5ca83bb4fc7faa7d4cf69';
Demo.DEFAULT_PATH1 = "m/0'/0'";
Demo.DEFAULT_PATH2 = "m/0'/1'";

class KeyStore {
    static _requestAsPromise(request) {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    static _readAllFromCursor(request) {
        return new Promise((resolve, reject) => {
            const results = [];
            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor) {
                    results.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    constructor() {
        this._dbPromise = null;
        this._indexedDB = window.indexedDB;
    }

    async get(id) {
        const db = await this.connect();
        const request = db.transaction([KeyStore.DB_KEY_STORE_NAME])
            .objectStore(KeyStore.DB_KEY_STORE_NAME)
            .get(id);
        const result = await KeyStore._requestAsPromise(request);
        return result;
    }

    async put(keyInfo) {
        const db = await this.connect();
        const request = db.transaction([KeyStore.DB_KEY_STORE_NAME], 'readwrite')
            .objectStore(KeyStore.DB_KEY_STORE_NAME)
            .put(keyInfo);
        return KeyStore._requestAsPromise(request);
    }

    async remove(id) {
        const db = await this.connect();
        const request = db.transaction([KeyStore.DB_KEY_STORE_NAME], 'readwrite')
            .objectStore(KeyStore.DB_KEY_STORE_NAME)
            .delete(id);
        return KeyStore._requestAsPromise(request);
    }

    async list() {
        const db = await this.connect();
        const request = db.transaction([KeyStore.DB_KEY_STORE_NAME], 'readonly')
            .objectStore(KeyStore.DB_KEY_STORE_NAME)
            .openCursor();

        return KeyStore._readAllFromCursor(request);
    }

    async close() {
        if (!this._dbPromise) { return; }
        // If failed to open database (i.e. dbPromise rejects) we don't need to close the db
        const db = await this._dbPromise.catch(() => null);
        this._dbPromise = null;
        if (db) { db.close(); }
    }

    async connect() {
        if (this._dbPromise) { return this._dbPromise; }

        this._dbPromise = new Promise((resolve, reject) => {
            const request = this._indexedDB.open(KeyStore.DB_NAME, KeyStore.DB_VERSION);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
            request.onupgradeneeded = (event) => {
                const db = request.result;

                if (event.oldVersion < 1) {
                    // Version 1 is the first version of the database.
                    db.createObjectStore(KeyStore.DB_KEY_STORE_NAME, { keyPath: 'id' });
                }
            };
        });

        return this._dbPromise;
    }

}
KeyStore.DB_VERSION = 1;
KeyStore.DB_NAME = 'nimiq-keyguard';
KeyStore.DB_KEY_STORE_NAME = 'keys';
