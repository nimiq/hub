import {KeyInfo, KeyStorageType} from '@/lib/KeyInfo';
import {KeyStore} from '@/lib/KeyStore';
import {AddressInfo} from '@/lib/AddressInfo';
import {ContractType} from '@/lib/ContractInfo';

const Nimiq = require('@nimiq/core'); // tslint:disable-line:no-var-requires variable-name
// @ts-ignore
global.Nimiq = Nimiq;

const indexedDB: IDBFactory = require('fake-indexeddb'); // tslint:disable-line:no-var-requires

const DUMMY_ADDRESS = Nimiq.Address.fromUserFriendlyAddress('NQ07 0000 0000 0000 0000 0000 0000 0000 0000');
const DUMMY: KeyInfo[] = [
    new KeyInfo('funny-giraffe', 'Main',
        new Map<string, AddressInfo>([
            ['m/0', new AddressInfo('m/0', 'MyAccount', DUMMY_ADDRESS)],
        ]), [], KeyStorageType.BIP39),
    new KeyInfo('joyful-cat', 'Ledger',
        new Map<string, AddressInfo>([
            ['m/0', new AddressInfo('m/0', 'MyLedger', DUMMY_ADDRESS)],
        ]), [{
            address: DUMMY_ADDRESS,
            label: 'Savings',
            ownerPath: 'm/0',
            type: ContractType.VESTING,
        }], KeyStorageType.LEDGER),
    new KeyInfo('sad-panda', 'Old',
        new Map<string, AddressInfo>([
            ['m/0', new AddressInfo('m/0', 'OldAccount', DUMMY_ADDRESS)],
        ]), [], KeyStorageType.LEGACY),
];

const beforeEachCallback = async () => {
    KeyStore.INDEXEDDB_IMPLEMENTATION = indexedDB;
    await Promise.all(DUMMY.map(KeyStore.Instance.put.bind(KeyStore.Instance)));
    await KeyStore.Instance.close();
};

const afterEachCallback = async () => {
    await KeyStore.Instance.close();
    await new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(KeyStore.DB_NAME);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(true);
        request.onblocked = () => {
            // wait for open connections to get closed
            setTimeout(() => reject(new Error('Can\'t delete database, there is still an open connection.')), 1000);
        };
    });
    // delete KeyStore.instance;
};

describe('KeyStore', () => {

    beforeEach(beforeEachCallback);

    afterEach(afterEachCallback);

    it('is a singleton', () => {
        const instance1 = KeyStore.Instance;
        const instance2 = KeyStore.Instance;
        expect(instance1).toBe(instance2);
    });

    it('can get plain key infos', async () => {
        const [key1, key2, key3] = await Promise.all([
            KeyStore.Instance.get(DUMMY[0].id),
            KeyStore.Instance.get(DUMMY[1].id),
            KeyStore.Instance.get(DUMMY[2].id),
        ]);
        expect(key1).toEqual(DUMMY[0]);
        expect(key2).toEqual(DUMMY[1]);
        expect(key3).toEqual(DUMMY[2]);
    });

    it('can list keys', async () => {
        const keys = await KeyStore.Instance.list();
        expect(keys).toEqual(DUMMY);
    });

    it('can remove keys', async () => {
        let currentKeys = await KeyStore.Instance.list();
        expect(currentKeys.length).toBe(3);

        await KeyStore.Instance.remove(DUMMY[1].id);
        currentKeys = await KeyStore.Instance.list();
        expect(currentKeys.length).toBe(2);
        expect(currentKeys[1].id).not.toBe(DUMMY[1].id);

        // check that we can't get a removed key by id
        const removedKey = await KeyStore.Instance.get(DUMMY[1].id);
        expect(removedKey).toBeUndefined();
    });

    it('can add and update keys', async () => {
        // first clear database
        await afterEachCallback();

        let currentPermissions = await KeyStore.Instance.list();
        expect(currentPermissions.length).toBe(0);

        // add permissions
        await KeyStore.Instance.put(DUMMY[1]);
        currentPermissions = await KeyStore.Instance.list();
        expect(currentPermissions.length).toBe(1);

        // check that the key info has been stored correctly
        let keyInfo = await KeyStore.Instance.get(DUMMY[1].id);
        expect(keyInfo).toEqual(DUMMY[1]);

        keyInfo!.contracts.pop();
        keyInfo!.addresses.set('m/1', new AddressInfo('m/1', 'Test', DUMMY_ADDRESS));

        // Update the key
        await KeyStore.Instance.put(keyInfo!);

        // Check that the info have been updated correctly
        keyInfo = await KeyStore.Instance.get(DUMMY[1].id);
        expect(keyInfo).toBeDefined();
        expect(keyInfo!.contracts.length).toBe(0);
        expect(keyInfo!.addresses.size).toBe(2);
        expect(keyInfo!.addresses.get('m/1')).toBeDefined();
        expect(keyInfo!.addresses.get('m/1')!.path).toBe('m/1');
    });
});
