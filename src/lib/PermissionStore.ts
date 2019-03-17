import Config from 'config';

export interface Permission {
    origin: string;
    allowsAll: boolean;
    addresses: Nimiq.Address[];
}

interface PermissionEntry {
    origin: string;
    allowsAll: boolean;
    addresses: Uint8Array[];
}

export class PermissionStore {
    public static readonly DB_VERSION = 1;
    public static readonly DB_NAME = 'nimiq-permissions';
    public static readonly DB_STORE_NAME = 'permissions';

    public static INDEXEDDB_IMPLEMENTATION = window.indexedDB;

    private static instance: PermissionStore | null = null;

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
    private indexedDB: IDBFactory;

    public static get Instance() {
        this.instance = this.instance || new PermissionStore();
        return this.instance;
    }

    private constructor() {
        this.dbPromise = null;
        this.indexedDB = PermissionStore.INDEXEDDB_IMPLEMENTATION;
    }

    public async get(origin: string): Promise<Permission> {
        const db = await this.connect();
        const request = db.transaction([PermissionStore.DB_STORE_NAME])
            .objectStore(PermissionStore.DB_STORE_NAME)
            .get(origin);

        const result: PermissionEntry = await PermissionStore._requestAsPromise(request);
        return result ? {
            ...result,
            addresses: result.addresses.map((address) => Nimiq.Address.unserialize(new Nimiq.SerialBuffer(address))),
        } : result;
    }

    public async put(origin: string, addresses: true | Nimiq.Address[]): Promise<string> {
        const permissionEntry: PermissionEntry = {
            origin,
            allowsAll: addresses === true,
            addresses: addresses !== true ? addresses.map((address) => address.serialize()) : [],
        };

        const db = await this.connect();
        const request = db.transaction([PermissionStore.DB_STORE_NAME], 'readwrite')
            .objectStore(PermissionStore.DB_STORE_NAME)
            .put(permissionEntry);

        return PermissionStore._requestAsPromise(request);
    }

    /* For semantic convenience */
    public async allow(origin: string, addresses: true | Nimiq.Address[]): Promise<string> {
        return this.put(origin, addresses);
    }

    public async remove(origin: string): Promise<undefined> {
        const db = await this.connect();
        const request = db.transaction([PermissionStore.DB_STORE_NAME], 'readwrite')
            .objectStore(PermissionStore.DB_STORE_NAME)
            .delete(origin);

        return PermissionStore._requestAsPromise(request);
    }

    public async list(): Promise<Permission[]> {
        const db = await this.connect();
        const request = db.transaction([PermissionStore.DB_STORE_NAME], 'readonly')
            .objectStore(PermissionStore.DB_STORE_NAME)
            .openCursor();

        const result: PermissionEntry[] = await PermissionStore._readAllFromCursor(request);
        return result ? result.map((entry) => ({
            ...entry,
            addresses: entry.addresses.map((address) => Nimiq.Address.unserialize(new Nimiq.SerialBuffer(address))),
        })) : result;
    }

    public async close(): Promise<void> {
        if (!this.dbPromise) return;
        // If failed to open database (i.e. dbPromise rejects) we don't need to close the db
        const db = await this.dbPromise.catch(() => null);
        this.dbPromise = null;
        if (db) db.close();
    }

    private async connect(): Promise<IDBDatabase> {
        if (this.dbPromise) return this.dbPromise;

        this.dbPromise = new Promise((resolve, reject) => {
            const request = this.indexedDB.open(PermissionStore.DB_NAME, PermissionStore.DB_VERSION);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
            request.onupgradeneeded = (event) => {
                const db: IDBDatabase = request.result;

                if (event.oldVersion < 1) {
                    // Version 1 is the first version of the database.
                    const store = db.createObjectStore(PermissionStore.DB_STORE_NAME, { keyPath: 'origin' });

                    // Add default permissions
                    store.transaction.oncomplete = () => {
                        const defaultPermissions = Config.privilegedOrigins.map((origin) => ({
                            origin,
                            allowsAll: true,
                            addresses: [],
                        }));

                        // Store values in the newly created objectStore.
                        const permissionObjectStore = db.transaction([PermissionStore.DB_STORE_NAME], 'readwrite')
                            .objectStore(PermissionStore.DB_STORE_NAME);

                        defaultPermissions.forEach((permission) => permissionObjectStore.add(permission));
                    };
                }
            };
        });

        return this.dbPromise;
    }
}
