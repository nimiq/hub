import { WalletInfo, WalletInfoEntry } from '@/lib/WalletInfo';

export class WalletStore {
    public static readonly DB_VERSION = 3;
    public static readonly DB_NAME = 'nimiq-accounts';
    public static readonly DB_KEY_STORE_NAME = 'wallets';

    public static readonly WALLET_ID_LENGTH = 6;

    public static INDEXEDDB_IMPLEMENTATION = window.indexedDB;

    public static async deriveId(keyId: string): Promise<string> {
        const wallets = await WalletStore.Instance.list();
        const existingWallet = wallets.find((wallet) => wallet.keyId === keyId);
        if (existingWallet) return existingWallet.id;

        const existingIds = wallets.map((wallet) => wallet.id);
        const keyIdBytes = Nimiq.BufferUtils.fromBase64(keyId);

        for (let i = 0; i <= (32 - WalletStore.WALLET_ID_LENGTH); i++) {
            const id = Nimiq.BufferUtils.toHex(keyIdBytes.subarray(i, i + WalletStore.WALLET_ID_LENGTH));
            if (existingIds.indexOf(id) === -1) return id;
        }

        // Could not find an available wallet ID in the searched space.

        // Hash keyId and recurse
        const hashedKeyIdBytes = Nimiq.Hash.computeSha256(keyIdBytes);
        return WalletStore.deriveId(Nimiq.BufferUtils.toBase64(hashedKeyIdBytes));
    }

    private static instance: WalletStore | null = null;

    private static async _requestAsPromise(request: IDBRequest, transaction: IDBTransaction): Promise<any> {
        return Promise.all([
            new Promise((resolve, reject) => {
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            }),
            new Promise((resolve, reject) => {
                transaction.oncomplete = () => resolve();
                transaction.onabort = () => reject(transaction.error);
                transaction.onerror = () => reject(transaction.error);
            }),
        ])
        // Promise.all returns an array of resolved promises, but we are only
        // interested in the request.result, which is the first item.
        .then((result) => result[0]);
    }

    private static _readAllFromCursor(request: IDBRequest): Promise<any[]> {
        return new Promise((resolve, reject) => {
            const results: any[] = [];
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

    private _dbPromise: Promise<IDBDatabase> | null;
    private _indexedDB: IDBFactory;

    static get Instance(): WalletStore {
        WalletStore.instance = WalletStore.instance || new WalletStore();
        return WalletStore.instance;
    }

    private constructor() {
        this._dbPromise = null;
        this._indexedDB = WalletStore.INDEXEDDB_IMPLEMENTATION;
    }

    public async get(id: string): Promise<WalletInfo | null> {
        const db = await this.connect();
        const transaction = db.transaction([WalletStore.DB_KEY_STORE_NAME]);
        const request = transaction.objectStore(WalletStore.DB_KEY_STORE_NAME).get(id);
        const result = await WalletStore._requestAsPromise(request, transaction);
        return result ? WalletInfo.fromObject(result) : result;
    }

    public async put(walletInfo: WalletInfo) {
        const db = await this.connect();
        const transaction = db.transaction([WalletStore.DB_KEY_STORE_NAME], 'readwrite');
        const request = transaction.objectStore(WalletStore.DB_KEY_STORE_NAME).put(walletInfo.toObject());
        return WalletStore._requestAsPromise(request, transaction);
    }

    public async remove(id: string) {
        const db = await this.connect();
        const transaction = db.transaction([WalletStore.DB_KEY_STORE_NAME], 'readwrite');
        const request = transaction.objectStore(WalletStore.DB_KEY_STORE_NAME).delete(id);
        return WalletStore._requestAsPromise(request, transaction);
    }

    public async list(): Promise<WalletInfoEntry[]> {
        const db = await this.connect();
        const request = db.transaction([WalletStore.DB_KEY_STORE_NAME], 'readonly')
            .objectStore(WalletStore.DB_KEY_STORE_NAME)
            .openCursor();

        const result: WalletInfoEntry[] = await WalletStore._readAllFromCursor(request);
        return result;
    }

    public async close() {
        if (!this._dbPromise) { return; }
        // If failed to open database (i.e. dbPromise rejects) we don't need to close the db
        const db = await this._dbPromise.catch(() => null);
        this._dbPromise = null;
        if (db) { db.close(); }
    }

    private async connect(): Promise<IDBDatabase> {
        if (this._dbPromise) { return this._dbPromise; }

        this._dbPromise = new Promise((resolve, reject) => {
            const request = this._indexedDB.open(WalletStore.DB_NAME, WalletStore.DB_VERSION);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
            request.onupgradeneeded = (event) => {
                const db = request.result;

                if (event.oldVersion < 1) {
                    // Version 1 is the first version of the database.
                    db.createObjectStore(WalletStore.DB_KEY_STORE_NAME, { keyPath: 'id' });
                }

                if (event.oldVersion < 2) {
                    // Change to version 2 just to delete former testnet databases, because we do the same in keyguard.
                    db.deleteObjectStore(WalletStore.DB_KEY_STORE_NAME);
                    db.createObjectStore(WalletStore.DB_KEY_STORE_NAME, { keyPath: 'id' });
                }

                if (event.oldVersion < 3) {
                    // Change to version 3 just to delete former testnet databases, because we do the same in keyguard.
                    db.deleteObjectStore(WalletStore.DB_KEY_STORE_NAME);
                    db.createObjectStore(WalletStore.DB_KEY_STORE_NAME, { keyPath: 'id' });
                }
            };
        });

        return this._dbPromise;
    }
}
