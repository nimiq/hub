import { setup } from './_setup';
import { Store } from '@/lib/Store';
import { CashlinkStore } from '@/lib/CashlinkStore';
import { CashlinkState, CashlinkType, CashlinkInfo } from '@/lib/CashlinkInfo';

setup();

const indexedDB: IDBFactory = require('fake-indexeddb'); // tslint:disable-line:no-var-requires

// @ts-ignore private method call
Store.INDEXEDDB_IMPLEMENTATION = indexedDB;

const DUMMY_DATA: CashlinkInfo[] = [
    new CashlinkInfo(
        'NQ07 0000 0000 0000 0000 0000 0000 0000 0000',
        Nimiq.PrivateKey.generate(),
        CashlinkType.OUTGOING,
        1234554321,
        'Ein Cashlink test Cashlink',
        Date.now(),
        CashlinkState.UNCLAIMED,
        'Test name',
        'NQ07 0000 0000 0000 0000 0000 0000 0000 0000',
        'Sent me a cashlink',
    ),
    new CashlinkInfo(
        'NQ38 RLRR UN7M TMGU X685 LCV0 8L6K QXNE FMVL',
        Nimiq.PrivateKey.generate(),
        CashlinkType.INCOMING,
        5000000,
        'Ein Cashlink test Cashlink',
        Date.now(),
        CashlinkState.UNKNOWN,
        'Test name',
        'NQ07 0000 0000 0000 0000 0000 0000 0000 0000',
        'Sent me a cashlink',
    ),
];

const beforeEachCallback = async () => {
    await Promise.all(DUMMY_DATA.map((cashlink) => CashlinkStore.Instance.put(cashlink)));
    await CashlinkStore.Instance.close();
};

const afterEachCallback = async () => {
    await CashlinkStore.Instance.close();
    await new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(CashlinkStore.Instance.getConstants().DB_NAME);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(true);
        request.onblocked = () => {
            // wait for open connections to get closed
            setTimeout(() => reject(new Error('Can\'t delete database, there is still an open connection.')), 1000);
        };
    });
};

describe('CashlinkStore', () => {
    beforeEach(beforeEachCallback);
    afterEach(afterEachCallback);

    it('is a singleton', () => {
        const instance1 = CashlinkStore.Instance;
        const instance2 = CashlinkStore.Instance;
        expect(instance1).toBe(instance2);
    });

    it('can get CashlinkInfo', async () => {
        const cl = await CashlinkStore.Instance.get('NQ07 0000 0000 0000 0000 0000 0000 0000 0000');
        expect(cl).toEqual(DUMMY_DATA[0]);
    });

    it('can list keys', async () => {
        const keys = await CashlinkStore.Instance.list();
        expect(keys).toEqual(DUMMY_DATA.map((wi) => wi.toObject()));
    });

    it('can remove keys', async () => {
        let currentKeys = await CashlinkStore.Instance.list();
        expect(currentKeys.length).toBe(2);

        await CashlinkStore.Instance.remove(DUMMY_DATA[0].address);
        currentKeys = await CashlinkStore.Instance.list();
        expect(currentKeys.length).toBe(1);
        expect(currentKeys[0].address).not.toBe(DUMMY_DATA[0].address);

        // check that we can't get a removed key by id
        const removedKey = await CashlinkStore.Instance.get(DUMMY_DATA[0].address);
        expect(removedKey).toBeUndefined();
    });

    it('can add and update keys', async () => {
        // first clear database
        await afterEachCallback();

        let currentPermissions = await CashlinkStore.Instance.list();
        expect(currentPermissions.length).toBe(0);

        // add permissions
        await CashlinkStore.Instance.put(DUMMY_DATA[0]);
        currentPermissions = await CashlinkStore.Instance.list();
        expect(currentPermissions.length).toBe(1);

        // check that the key info has been stored correctly
        let cashlink = await CashlinkStore.Instance.get(DUMMY_DATA[0].address);
        expect(cashlink).toEqual(DUMMY_DATA[0]);

        cashlink!.state = CashlinkState.CLAIMED;
        cashlink!.otherParty = DUMMY_DATA[1].address;

        // Update the key
        await CashlinkStore.Instance.put(cashlink!);

        // Check that the info have been updated correctly
        cashlink = await CashlinkStore.Instance.get(DUMMY_DATA[0].address);
        expect(cashlink).toBeDefined();
        expect(cashlink!.state).toBe(CashlinkState.CLAIMED);
        expect(cashlink!.otherParty).toBe(DUMMY_DATA[1].address);
        expect(cashlink!.name).toBe(DUMMY_DATA[0].name);
    });
});
