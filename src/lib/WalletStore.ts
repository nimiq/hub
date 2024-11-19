import { WalletInfo, WalletInfoEntry } from '@/lib/WalletInfo';
import { Store } from '@/lib/Store';

/**
 * With two ObjectStores sharing the same Database, types inside the Store are not well defined.
 * To the outside however, that is completely transparent.
 */
export class WalletStore extends Store<any, WalletInfoEntry> {
    public static readonly DB_ACCOUNTS_STORE_NAME = 'accounts';
    public static readonly DB_META_DATA_STORE_NAME = 'meta-data';

    public static readonly WALLET_ID_LENGTH = 6;
    public static readonly SALT_LENGTH = 16;

    private static instance: WalletStore | null = null;
    private _storeName: string = WalletStore.DB_ACCOUNTS_STORE_NAME;

    protected get DB_NAME(): string {
        return 'nimiq-hub';
    }

    protected get DB_STORE_NAME(): string {
        return this._storeName;
    }

    protected get DB_VERSION(): number {
        return 1;
    }

    public static get Instance(): WalletStore {
        if (!WalletStore.instance) WalletStore.instance = new WalletStore();
        return WalletStore.instance;
    }

    public async deriveId(keyId: string): Promise<string> {
        const wallets = await this.list();
        const existingWallet = wallets.find((wallet) => wallet.keyId === keyId);
        if (existingWallet) return existingWallet.id;

        const existingIds = wallets.map((wallet) => wallet.id);
        const keyIdBytes = Nimiq.BufferUtils.fromBase64(keyId);

        // Hashing with a random salt that does not leave the hub to avoid that an external app can derive wallet id's
        // from public keys (Legacy and Ledger accounts) or get a hint for private key guessing / brute forcing (for
        // BIP39) as hashing the private key is cheaper than deriving the public key.
        const salt = await this._getSalt();
        const saltedKeyIdBytes = new Uint8Array(keyIdBytes.length + salt.length);
        saltedKeyIdBytes.set(keyIdBytes, 0);
        saltedKeyIdBytes.set(salt, keyIdBytes.length);
        const keyIdHash = Nimiq.Hash.computeBlake2b(saltedKeyIdBytes);

        for (let i = 0; i <= (keyIdHash.length - WalletStore.WALLET_ID_LENGTH); i++) {
            const id = Nimiq.BufferUtils.toHex(keyIdHash.subarray(i, i + WalletStore.WALLET_ID_LENGTH));
            if (existingIds.indexOf(id) === -1) return id;
        }

        // Could not find an available wallet ID in the searched space.
        // Recurse with the hashed value.
        return this.deriveId(Nimiq.BufferUtils.toBase64(keyIdHash));
    }

    public async get(id: string): Promise<WalletInfo | null> {
        this._storeName = WalletStore.DB_ACCOUNTS_STORE_NAME;
        const result = await super.get(id);
        return result ? WalletInfo.fromObject(result) : result;
    }

    public async put(walletInfo: WalletInfo) {
        this._storeName = WalletStore.DB_ACCOUNTS_STORE_NAME;
        return super.put(walletInfo.toObject());
    }

    public async remove(id: string) {
        this._storeName = WalletStore.DB_ACCOUNTS_STORE_NAME;
        return super.remove(id);
    }

    public async list(): Promise<WalletInfoEntry[]> {
        this._storeName = WalletStore.DB_ACCOUNTS_STORE_NAME;
        return super.list() as Promise<WalletInfoEntry[]>;
    }

    protected upgrade(request: any, event: IDBVersionChangeEvent): void {
        const db = request.result;
        if (event.oldVersion < 1) {
            // Version 1 is the first version of the database.
            db.createObjectStore(WalletStore.DB_ACCOUNTS_STORE_NAME, { keyPath: 'id' });
            db.createObjectStore(WalletStore.DB_META_DATA_STORE_NAME, { keyPath: 'name' });
        }
    }

    protected toEntry<T>(walletInfoOrMetaData: T): T {
        return walletInfoOrMetaData;
    }

    protected fromEntry<T>(walletEntryOrMetaDataEntry: T): T {
        return walletEntryOrMetaDataEntry;
    }

    private async _getMetaData(name: string): Promise<any> {
        this._storeName = WalletStore.DB_META_DATA_STORE_NAME;
        const result = await super.get(name);
        return result ? result.value : null;
    }

    private async _putMetaData(name: string, value: any): Promise<void> {
        this._storeName = WalletStore.DB_META_DATA_STORE_NAME;
        return super.put({value, name});
    }

    private async _getSalt() {
        let salt: Uint8Array = await this._getMetaData('salt');
        if (salt) return salt;
        salt = new Uint8Array(WalletStore.SALT_LENGTH);
        window.crypto.getRandomValues(salt);
        await this._putMetaData('salt', salt);
        return salt;
    }
}
