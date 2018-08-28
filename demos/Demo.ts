import * as Rpc from '@nimiq/rpc';
import AccountsManagerClient from '../client/AccountsManagerClient';
import {RequestType} from '../src/lib/RequestTypes';

class Demo {
    public static ENTROPY = 'abb107d2c9adafed0b2ff41c0cfbe4ad4352b11362c5ca83bb4fc7faa7d4cf69';
    public static DEFAULT_PATH1 = 'm/0\'/0\'';
    public static DEFAULT_PATH2 = 'm/0\'/1\'';

    public static run() {
        (async () => {
            await Nimiq.WasmHelper.doImportBrowser();
            Nimiq.GenesisConfig.test();
            document.querySelectorAll('button').forEach(button => button.disabled = false);
        })();

        const demo = new Demo('http://localhost:8000');

        const client = new AccountsManagerClient('http://localhost:8080');
        client.on(RequestType.CHECKOUT, (result, state) => {
            console.log('AccountsManager result', result);
            console.log('State', state);

            document.querySelector('#result').textContent = 'TX signed';
            demo.tearDown().catch(console.error);
        }, (error, state) => {
            console.error('AccountsManager error', error);
            console.log('State', state);

            document.querySelector('#result').textContent = `Error: ${error.message || error}`;
            demo.tearDown().catch(console.error);
        });
        client.init();

        document.querySelector('button#redirect').addEventListener('click', async () => {
            checkoutRedirect(await generateRequest(demo));
        });

        document.querySelector('button#popup').addEventListener('click', async () => {
            client.createPopup(
                `left=${window.innerWidth / 2 - 500},top=50,width=1000,height=900,location=yes,dependent=yes`
            );
            await checkoutPopup(await generateRequest(demo));
        });

        async function generateRequest(demo) {
            const value = parseInt(document.querySelector('#value').value) || 1337;
            const txFee = parseInt(document.querySelector('#fee').value) || 0;
            const txData = document.querySelector('#data').value || '';
            const keyPassphrase = document.querySelector('#passphrase').value || '';

            await demo.setUp(keyPassphrase);

            return {
                appName: 'Accounts Demos',
                recipient: Nimiq.Address.fromUserFriendlyAddress('NQ63 U7XG 1YYE D6FA SXGG 3F5H X403 NBKN JLDU').serialize(),
                value,
                fee: txFee,
                data: Nimiq.BufferUtils.fromAscii(txData)
            };
        }

        function checkoutRedirect(txRequest) {
            return client.checkout(txRequest);
        }

        async function checkoutPopup(txRequest) {
            try {
                const result = await client.checkout(txRequest);
                console.log('Keyguard result', result);
                document.querySelector('#result').textContent = 'TX signed';
            } catch (e) {
                console.error('Keyguard error', e);
                document.querySelector('#result').textContent = `Error: ${e.message || e}`;
            }

            await demo.tearDown();
        }
    }

    private static _deriveAddressInfo(entropy, path) {
        return {
            path,
            label: 'Standard Account',
            address: Demo._deriveAddress(entropy, path).serialize()
        };
    }

    private static _deriveAddress(entropy, path) {
        const privKey = entropy.toExtendedPrivateKey().derivePath(path).privateKey;
        const pubKey = Nimiq.PublicKey.derive(privKey);
        return pubKey.toAddress();
    }

    private static _keyIdFromEntropy(entropy) {
        return Nimiq.BufferUtils.toHex(Nimiq.Hash.blake2b(entropy.serialize()).subarray(0, 6));
    }

    private static async _createIframe(baseUrl) {
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

    private _iframeClient: any;
    private _keyguardBaseUrl: string;

    constructor(keyguardBaseUrl) {
        this._iframeClient = null;
        this._keyguardBaseUrl = keyguardBaseUrl;
    }

    public async setUp(keyPassphrase) {
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

    public async tearDown() {
        // Local tearDown
        const entropy = new Nimiq.Entropy(Nimiq.BufferUtils.fromHex(Demo.ENTROPY));

        const keyStore = new KeyStore();
        await keyStore.remove(Demo._keyIdFromEntropy(entropy));
        await keyStore.close();

        // Then remote tearDown
        const keyguardSetup = await this.startIframeClient(this._keyguardBaseUrl);
        await keyguardSetup.call('tearDown');
    }

    public async startIframeClient(baseUrl) {
        if (this._iframeClient) return this._iframeClient;
        const $iframe = await Demo._createIframe(baseUrl);
        if (!$iframe.contentWindow) throw new Error(`IFrame contentWindow is ${typeof $iframe.contentWindow}`);
        this._iframeClient = new Rpc.PostMessageRpcClient($iframe.contentWindow, '*');
        await this._iframeClient.init();
        return this._iframeClient;
    }
}

class KeyStore {
    public static DB_VERSION = 1;
    public static DB_NAME = 'nimiq-keyguard';
    public static DB_KEY_STORE_NAME = 'keys';

    private static _requestAsPromise(request) {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    private static _readAllFromCursor(request) {
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

    private _dbPromise: any;
    private _indexedDB: IDBFactory;

    constructor() {
        this._dbPromise = null;
        this._indexedDB = window.indexedDB;
    }

    public async get(id) {
        const db = await this.connect();
        const request = db.transaction([KeyStore.DB_KEY_STORE_NAME])
            .objectStore(KeyStore.DB_KEY_STORE_NAME)
            .get(id);
        const result = await KeyStore._requestAsPromise(request);
        return result;
    }

    public async put(keyInfo) {
        const db = await this.connect();
        const request = db.transaction([KeyStore.DB_KEY_STORE_NAME], 'readwrite')
            .objectStore(KeyStore.DB_KEY_STORE_NAME)
            .put(keyInfo);
        return KeyStore._requestAsPromise(request);
    }

    public async remove(id) {
        const db = await this.connect();
        const request = db.transaction([KeyStore.DB_KEY_STORE_NAME], 'readwrite')
            .objectStore(KeyStore.DB_KEY_STORE_NAME)
            .delete(id);
        return KeyStore._requestAsPromise(request);
    }

    public async list() {
        const db = await this.connect();
        const request = db.transaction([KeyStore.DB_KEY_STORE_NAME], 'readonly')
            .objectStore(KeyStore.DB_KEY_STORE_NAME)
            .openCursor();

        return KeyStore._readAllFromCursor(request);
    }

    public async close() {
        if (!this._dbPromise) { return; }
        // If failed to open database (i.e. dbPromise rejects) we don't need to close the db
        const db = await this._dbPromise.catch(() => null);
        this._dbPromise = null;
        if (db) { db.close(); }
    }

    public async connect() {
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

Demo.run();