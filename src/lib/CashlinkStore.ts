import Cashlink, { CashlinkEntry } from '@/lib/Cashlink';
import { Store } from '@/lib/Store';

export class CashlinkStore extends Store<Cashlink, CashlinkEntry> {
    private static instance: CashlinkStore | null = null;

    protected get DB_NAME(): string {
        return 'nimiq-cashlinks';
    }

    protected get DB_STORE_NAME(): string {
        return 'cashlinks';
    }

    protected get DB_VERSION(): number {
        return 1;
    }

    public static get Instance(): CashlinkStore {
        if (!CashlinkStore.instance) CashlinkStore.instance = new CashlinkStore();
        return CashlinkStore.instance;
    }

    protected upgrade(request: any, event: IDBVersionChangeEvent): void {
        const db = request.result;
        if (event.oldVersion < 1) {
            // Version 1 is the first version of the database.
            db.createObjectStore(this.DB_STORE_NAME, { keyPath: 'address' });
        }
    }

    protected toEntry(cashlink: Cashlink): CashlinkEntry {
        return cashlink.toObject(/*includeOptional*/ false);
    }

    protected fromEntry(cashlinkEntry: CashlinkEntry): Cashlink {
        return Cashlink.fromObject(cashlinkEntry);
    }
}
