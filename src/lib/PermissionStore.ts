interface Permission {
    origin: string;
    allowsAll: boolean;
    addresses: string[];
}

export default class PermissionStore {
    public static readonly ALL_ADDRESSES = 'all-addresses';

    public static readonly DB_VERSION = 1;
    public static readonly DB_NAME = 'nimiq-permissions';
    public static readonly DB_STORE_NAME = 'permissions';

    private static instance: PermissionStore;
    private dbPromise: Promise<IDBDatabase>|null;

    public static get Instance() {
        this.instance = this.instance || new PermissionStore();
        return this.instance;
    }

    private constructor() {
        this.dbPromise = null;
    }

    public allowByOrigin(origin: string, addresses: string|string[]): Promise<string> {
        const permission = {
            origin,
            allowsAll: addresses === PermissionStore.ALL_ADDRESSES,
            addresses: addresses === PermissionStore.ALL_ADDRESSES
                ? []
                : Array.isArray(addresses)
                    ? addresses
                    : [addresses],
        };

        return this._put(permission);
    }

    public getByOrigin(origin: string): Promise<Permission> {
        return this._get(origin);
    }

    public removeByOrigin(origin: string): Promise<true> {
        return this._remove(origin);
    }

    public list(): Promise<Permission[]> {
        return this._list();
    }

    public async close(): Promise<void> {
        if (!this.dbPromise) { return; }
        // If failed to open database (i.e. dbPromise rejects) we don't need to close the db
        const db = await this.dbPromise.catch(() => null);
        this.dbPromise = null;
        if (db) { db.close(); }
    }

    private async connect(): Promise<IDBDatabase> {
        if (this.dbPromise) { return this.dbPromise; }

        this.dbPromise = new Promise((resolve, reject) => {
            const request = window.indexedDB.open(PermissionStore.DB_NAME, PermissionStore.DB_VERSION);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
            request.onupgradeneeded = (event) => {
                const db: IDBDatabase = request.result;

                if (event.oldVersion < 1) {
                    // Version 1 is the first version of the database.
                    const store = db.createObjectStore(PermissionStore.DB_STORE_NAME, { keyPath: 'origin' });
                }

                // if (event.oldVersion < 2) {
                //     // Version 2 ...
                // }
            };
        });

        return this.dbPromise;
    }

    private async _put(permission: Permission): Promise<any> {
        const db = await this.connect();
        return new Promise((resolve, reject) => {
            const request = db.transaction([PermissionStore.DB_STORE_NAME], 'readwrite')
                .objectStore(PermissionStore.DB_STORE_NAME)
                .put(permission);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    private async _get(origin: string): Promise<any> {
        const db = await this.connect();
        return new Promise((resolve, reject) => {
            const request = db.transaction([PermissionStore.DB_STORE_NAME])
                .objectStore(PermissionStore.DB_STORE_NAME)
                .get(origin);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    private async _list(): Promise<any> {
        const db = await this.connect();
        return new Promise((resolve, reject) => {
            const results: Permission[] = [];
            const request = db.transaction([PermissionStore.DB_STORE_NAME], 'readonly')
                .objectStore(PermissionStore.DB_STORE_NAME)
                .openCursor();
            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor) {
                    const permission: Permission = cursor.value;
                    results.push(permission);
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    private async _remove(origin: string): Promise<any> {
        const db = await this.connect();
        return new Promise((resolve, reject) => {
            const request = db.transaction([PermissionStore.DB_STORE_NAME], 'readwrite')
                .objectStore(PermissionStore.DB_STORE_NAME)
                .delete(origin);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }
}
