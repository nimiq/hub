/**
 * Usage:
 * <script src="lib/key.js"></script>
 * <script src="lib/key-store-indexeddb.js"></script>
 *
 * const keyStore = KeyStore.instance;
 * const accounts = await keyStore.list();
 */
class KeyStore {
    public static readonly DB_VERSION = 1;
    public static readonly DB_NAME = 'nimiq-keyguard';
    public static readonly DB_KEY_STORE_NAME = 'keys';

    private static storeInstance: KeyStore | null = null;

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

    private dbPromise: Promise<IDBDatabase> | null;

    static get instance(): KeyStore {
        KeyStore.storeInstance = KeyStore.storeInstance || new KeyStore();
        return KeyStore.storeInstance;
    }

    constructor() {
        this.dbPromise = null;
    }

    public async get(id: string): Promise<KeyInfo | null> {
        const db = await this.connect();
        const request = db.transaction([KeyStore.DB_KEY_STORE_NAME])
            .objectStore(KeyStore.DB_KEY_STORE_NAME)
            .get(id);
        return KeyStore._requestAsPromise(request);
    }

    public async put(keyMetaData: KeyInfo) {
        const db = await this.connect();
        const request = db.transaction([KeyStore.DB_KEY_STORE_NAME], 'readwrite')
            .objectStore(KeyStore.DB_KEY_STORE_NAME)
            .put(keyMetaData);
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

        return KeyStore._readAllFromCursor(request);
    }

    public async close() {
        if (!this.dbPromise) { return; }
        // If failed to open database (i.e. dbPromise rejects) we don't need to close the db
        const db = await this.dbPromise.catch(() => null);
        this.dbPromise = null;
        if (db) { db.close(); }
    }

    private async connect(): Promise<IDBDatabase> {
        if (this.dbPromise) { return this.dbPromise; }

        this.dbPromise = new Promise((resolve, reject) => {
            const request = window.indexedDB.open(KeyStore.DB_NAME, KeyStore.DB_VERSION);
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

        return this.dbPromise;
    }

}
