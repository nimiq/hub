// tslint:disable-next-line:no-var-requires
const indexedDB: IDBFactory = require('fake-indexeddb');

import { Permission, PermissionStore } from '@/lib/PermissionStore.ts';

const Dummy: { permissions: Permission[]} = {
    permissions: [
        {
            origin: 'https://example1.com',
            allowsAll: false,
            addresses: ['abcd efgh ijkl mnop qrst uvwx yz01 2345 6789'],
        },
        {
            origin: 'https://example2.com',
            allowsAll: true,
            addresses: [],
        },
    ],
};

const beforeEachCallback = async () => {
    PermissionStore.INDEXEDDB_IMPLEMENTATION = indexedDB;
    await Promise.all([
        PermissionStore.Instance.allowByOrigin(Dummy.permissions[0].origin, Dummy.permissions[0].addresses[0]),
        PermissionStore.Instance.allowByOrigin(Dummy.permissions[1].origin, PermissionStore.ALL_ADDRESSES),
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

    it('is a singleton', () => {
        const instance1 = PermissionStore.Instance;
        const instance2 = PermissionStore.Instance;
        expect(instance1).toBe(instance2);
    });

    it('can get plain permissions', async () => {
        const [perm1, perm2] = await Promise.all([
            PermissionStore.Instance.getByOrigin(Dummy.permissions[0].origin),
            PermissionStore.Instance.getByOrigin(Dummy.permissions[1].origin),
        ]);
        expect(perm1).toEqual(Dummy.permissions[0]);
        expect(perm2).toEqual(Dummy.permissions[1]);
    });

    it('can list permissions', async () => {
        const permissions = await PermissionStore.Instance.list();
        expect(permissions).toEqual(Dummy.permissions);
    });

    it('can remove permissions', async () => {
        let currentPermissions = await PermissionStore.Instance.list();
        expect(currentPermissions).toEqual(Dummy.permissions);

        await PermissionStore.Instance.removeByOrigin(Dummy.permissions[0].origin);
        currentPermissions = await PermissionStore.Instance.list();
        expect(currentPermissions.length).toBe(1);
        expect(currentPermissions[0].origin).not.toBe(Dummy.permissions[0].origin);

        await PermissionStore.Instance.removeByOrigin(Dummy.permissions[1].origin);
        currentPermissions = await PermissionStore.Instance.list();
        expect(currentPermissions.length).toBe(0);

        // check that we can't get a removed key by address
        const removedKeys = await Promise.all([
            PermissionStore.Instance.getByOrigin(Dummy.permissions[0].origin),
            PermissionStore.Instance.getByOrigin(Dummy.permissions[1].origin),
        ]);
        expect(removedKeys[0]).toBeUndefined();
        expect(removedKeys[1]).toBeUndefined();
    });

    it('can add and update permissions', async () => {
        // first clear database
        await afterEachCallback();

        let currentPermissions = await PermissionStore.Instance.list();
        expect(currentPermissions.length).toBe(0);

        // add permissions
        await PermissionStore.Instance.allowByOrigin(Dummy.permissions[0].origin, Dummy.permissions[0].addresses);
        currentPermissions = await PermissionStore.Instance.list();
        expect(currentPermissions.length).toBe(1);

        await PermissionStore.Instance.allowByOrigin(Dummy.permissions[1].origin, PermissionStore.ALL_ADDRESSES),
        currentPermissions = await PermissionStore.Instance.list();
        expect(currentPermissions.length).toBe(2);

        // check that the permissions have been stored correctly
        const [permission1, permission2] = await Promise.all([
            PermissionStore.Instance.getByOrigin(Dummy.permissions[0].origin),
            PermissionStore.Instance.getByOrigin(Dummy.permissions[1].origin),
        ]);
        expect(permission1).toEqual(Dummy.permissions[0]);
        expect(permission2).toEqual(Dummy.permissions[1]);

        // update the permissions to be reverted
        await PermissionStore.Instance.allowByOrigin(Dummy.permissions[0].origin, PermissionStore.ALL_ADDRESSES);
        await PermissionStore.Instance.allowByOrigin(Dummy.permissions[1].origin, Dummy.permissions[0].addresses);

        // check that the permissions have been updated correctly
        const [updatedPermission1, updatedPermission2] = await Promise.all([
            PermissionStore.Instance.getByOrigin(Dummy.permissions[0].origin),
            PermissionStore.Instance.getByOrigin(Dummy.permissions[1].origin),
        ]);
        expect(updatedPermission1).toEqual({...Dummy.permissions[1], origin: Dummy.permissions[0].origin});
        expect(updatedPermission2).toEqual({...Dummy.permissions[0], origin: Dummy.permissions[1].origin});
    });
});
