import { setup } from './_setup';
import { Permission, PermissionStore } from '@/lib/PermissionStore';
import Config from '@/lib/Config';

setup();

const indexedDB: IDBFactory = require('fake-indexeddb'); // tslint:disable-line:no-var-requires

const DUMMY: { permissions: Permission[], nimiqOriginCount: number } = {
    permissions: [
        {
            origin: 'https://example1.com',
            allowsAll: false,
            addresses: [Nimiq.Address.fromUserFriendlyAddress('NQ07 0000 0000 0000 0000 0000 0000 0000 0000')],
        },
        {
            origin: 'https://example2.com',
            allowsAll: true,
            addresses: [],
        },
    ],
    nimiqOriginCount: Config.nimiqOrigins.length,
};

const beforeEachCallback = async () => {
    PermissionStore.INDEXEDDB_IMPLEMENTATION = indexedDB;
    await Promise.all([
        PermissionStore.Instance.allow(DUMMY.permissions[0].origin, DUMMY.permissions[0].addresses),
        PermissionStore.Instance.allow(DUMMY.permissions[1].origin, true),
    ]);
    await PermissionStore.Instance.close();
};

const afterEachCallback = async () => {
    await PermissionStore.Instance.close();
    await new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(PermissionStore.DB_NAME);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(true);
        request.onblocked = () => {
            // wait for open connections to get closed
            setTimeout(() => reject(new Error('Can\'t delete database, there is still an open connection.')), 1000);
        };
    });
    // delete PermissionStore.instance;
};

describe('PermissionStore', () => {

    beforeEach(beforeEachCallback);

    afterEach(afterEachCallback);

    xit('is a singleton', () => {
        const instance1 = PermissionStore.Instance;
        const instance2 = PermissionStore.Instance;
        expect(instance1).toBe(instance2);
    });

    xit('can get plain permissions', async () => {
        const [perm1, perm2] = await Promise.all([
            PermissionStore.Instance.get(DUMMY.permissions[0].origin),
            PermissionStore.Instance.get(DUMMY.permissions[1].origin),
        ]);
        expect(perm1).toEqual(DUMMY.permissions[0]);
        expect(perm2).toEqual(DUMMY.permissions[1]);
    });

    xit('can list permissions', async () => {
        const permissions = await PermissionStore.Instance.list();
        expect([permissions[DUMMY.nimiqOriginCount + 0],
            permissions[DUMMY.nimiqOriginCount + 1]]).toEqual(DUMMY.permissions);
    });

    xit('can remove permissions', async () => {
        let currentPermissions = await PermissionStore.Instance.list();
        expect(currentPermissions.length).toBe(DUMMY.nimiqOriginCount + 2);
        expect([currentPermissions[DUMMY.nimiqOriginCount + 0],
            currentPermissions[DUMMY.nimiqOriginCount + 1]]).toEqual(DUMMY.permissions);

        await PermissionStore.Instance.remove(DUMMY.permissions[0].origin);
        currentPermissions = await PermissionStore.Instance.list();
        expect(currentPermissions.length).toBe(DUMMY.nimiqOriginCount + 1);
        expect(currentPermissions[DUMMY.nimiqOriginCount + 0].origin).not.toBe(DUMMY.permissions[0].origin);

        await PermissionStore.Instance.remove(DUMMY.permissions[1].origin);
        currentPermissions = await PermissionStore.Instance.list();
        expect(currentPermissions.length).toBe(DUMMY.nimiqOriginCount);

        // check that we can't get a removed key by address
        const removedKeys = await Promise.all([
            PermissionStore.Instance.get(DUMMY.permissions[0].origin),
            PermissionStore.Instance.get(DUMMY.permissions[1].origin),
        ]);
        expect(removedKeys[0]).toBeUndefined();
        expect(removedKeys[1]).toBeUndefined();
    });

    xit('can add and update permissions', async () => {
        // first clear database
        await afterEachCallback();

        let currentPermissions = await PermissionStore.Instance.list();
        expect(currentPermissions.length).toBe(DUMMY.nimiqOriginCount);

        // add permissions
        await PermissionStore.Instance.allow(DUMMY.permissions[0].origin, DUMMY.permissions[0].addresses);
        currentPermissions = await PermissionStore.Instance.list();
        expect(currentPermissions.length).toBe(DUMMY.nimiqOriginCount + 1);

        await PermissionStore.Instance.allow(DUMMY.permissions[1].origin, true),
        currentPermissions = await PermissionStore.Instance.list();
        expect(currentPermissions.length).toBe(DUMMY.nimiqOriginCount + 2);

        // check that the permissions have been stored correctly
        const [permission1, permission2] = await Promise.all([
            PermissionStore.Instance.get(DUMMY.permissions[0].origin),
            PermissionStore.Instance.get(DUMMY.permissions[1].origin),
        ]);
        expect(permission1).toEqual(DUMMY.permissions[0]);
        expect(permission2).toEqual(DUMMY.permissions[1]);

        // update the permissions to be reverted
        await PermissionStore.Instance.allow(DUMMY.permissions[0].origin, true);
        await PermissionStore.Instance.allow(DUMMY.permissions[1].origin, DUMMY.permissions[0].addresses);

        // check that the permissions have been updated correctly
        const [updatedPermission1, updatedPermission2] = await Promise.all([
            PermissionStore.Instance.get(DUMMY.permissions[0].origin),
            PermissionStore.Instance.get(DUMMY.permissions[1].origin),
        ]);
        expect(updatedPermission1).toEqual({...DUMMY.permissions[1], origin: DUMMY.permissions[0].origin});
        expect(updatedPermission2).toEqual({...DUMMY.permissions[0], origin: DUMMY.permissions[1].origin});
    });
});
