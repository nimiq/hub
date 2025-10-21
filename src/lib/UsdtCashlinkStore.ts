import UsdtCashlink, { UsdtCashlinkEntry } from '@/lib/UsdtCashlink';
import { Store } from '@/lib/Store';

// TODO [USDT-CASHLINK]: This is a MOCK storage implementation for UI development
// Storage structure mirrors CashlinkStore but for USDT cashlinks on Polygon

export class UsdtCashlinkStore extends Store<UsdtCashlink, UsdtCashlinkEntry> {
    private static instance: UsdtCashlinkStore | null = null;

    protected get DB_NAME(): string {
        return 'nimiq-usdt-cashlinks';
    }

    protected get DB_STORE_NAME(): string {
        return 'usdt-cashlinks';
    }

    protected get DB_VERSION(): number {
        return 1;
    }

    public static get Instance(): UsdtCashlinkStore {
        if (!UsdtCashlinkStore.instance) UsdtCashlinkStore.instance = new UsdtCashlinkStore();
        return UsdtCashlinkStore.instance;
    }

    protected upgrade(request: any, event: IDBVersionChangeEvent): void {
        const db = request.result;
        if (event.oldVersion < 1) {
            // Version 1 is the first version of the database.
            db.createObjectStore(this.DB_STORE_NAME, { keyPath: 'address' });
        }
    }

    protected toEntry(usdtCashlink: UsdtCashlink): UsdtCashlinkEntry {
        // Exclude contactName and fee when writing to store to save some data
        return usdtCashlink.toObject(/*includeOptional*/ false);
    }

    protected fromEntry(usdtCashlinkEntry: UsdtCashlinkEntry): UsdtCashlink {
        return UsdtCashlink.fromObject(usdtCashlinkEntry);
    }
}
