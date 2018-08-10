import {KeyInfo} from '@/lib/KeyInfo';

export class KeyStore {
    public static readonly DB_VERSION = 1;
    public static readonly DB_NAME = 'nimiq-keyguard';
    public static readonly DB_KEY_STORE_NAME = 'keys';

    public static INDEXEDDB_IMPLEMENTATION = window.indexedDB;

    private static instance: KeyStore | null = null;

    private static _requestAsPromise(request: IDBRequest): Promise<any> {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
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

    static get Instance(): KeyStore {
        KeyStore.instance = KeyStore.instance || new KeyStore();
        return KeyStore.instance;
    }

    private constructor() {
        this._dbPromise = null;
        this._indexedDB = KeyStore.INDEXEDDB_IMPLEMENTATION;
    }

    public async get(id: string): Promise<KeyInfo | null> {
        const db = await this.connect();
        const request = db.transaction([KeyStore.DB_KEY_STORE_NAME])
            .objectStore(KeyStore.DB_KEY_STORE_NAME)
            .get(id);
        const result = await KeyStore._requestAsPromise(request);
        return result ? KeyInfo.fromObject(result) : result;
    }

    public async put(keyInfo: KeyInfo) {
        const db = await this.connect();
        const request = db.transaction([KeyStore.DB_KEY_STORE_NAME], 'readwrite')
            .objectStore(KeyStore.DB_KEY_STORE_NAME)
            .put(keyInfo.toObject());
        return KeyStore._requestAsPromise(request);
    }

    public async remove(id: string) {
        const db = await this.connect();
        const request = db.transaction([KeyStore.DB_KEY_STORE_NAME], 'readwrite')
            .objectStore(KeyStore.DB_KEY_STORE_NAME)
            .delete(id);
        return KeyStore._requestAsPromise(request);
    }

    public async list(): Promise<KeyInfo[]> {
        const db = await this.connect();
        const request = db.transaction([KeyStore.DB_KEY_STORE_NAME], 'readonly')
            .objectStore(KeyStore.DB_KEY_STORE_NAME)
            .openCursor();

        const result = await KeyStore._readAllFromCursor(request);
        return result.map((info) => KeyInfo.fromObject(info));
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
