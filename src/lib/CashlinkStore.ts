import Cashlink, { CashlinkEntry } from '@/lib/Cashlink';
import { Store, StoreConstants } from '@/lib/Store';

export class CashlinkStore extends Store<Cashlink, CashlinkEntry> {
    private static instance: CashlinkStore | null = null;

    static get Instance(): CashlinkStore {
        if (!CashlinkStore.instance) CashlinkStore.instance = new CashlinkStore();
        return CashlinkStore.instance;
    }

    public getConstants(): StoreConstants {
        return {
            DB_VERSION: 1,
            DB_NAME: 'nimiq-cashlinks',
            DB_STORE_NAME: 'cashlinks',
        };
    }

    protected upgrade(request: any, event: IDBVersionChangeEvent): void {
        const db = request.result;
        if (event.oldVersion < 1) {
            // Version 1 is the first version of the database.
            db.createObjectStore(this.getConstants().DB_STORE_NAME, { keyPath: 'address' });
        }
    }

    protected toEntry(cashlink: Cashlink): CashlinkEntry {
        return cashlink.toObject();
    }

    protected fromEntry(cashlinkEntry: CashlinkEntry): Cashlink {
        return Cashlink.fromObject(cashlinkEntry);
    }
}
