import { setup } from './_setup';
import { WalletInfo, WalletType } from '@/lib/WalletInfo';
import { WalletStore } from '@/lib/WalletStore';
import { AccountInfo } from '@/lib/AccountInfo';
import { ContractType } from '@/lib/ContractInfo';

setup();

const indexedDB: IDBFactory = require('fake-indexeddb'); // tslint:disable-line:no-var-requires

const DUMMY_ADDRESS = Nimiq.Address.fromUserFriendlyAddress('NQ07 0000 0000 0000 0000 0000 0000 0000 0000');
const DUMMY: WalletInfo[] = [
    new WalletInfo('funny-giraffe', 'Main',
        new Map<string, AccountInfo>([
            ['NQ07 0000 0000 0000 0000 0000 0000 0000 0000', new AccountInfo('m/0\'', 'MyAccount', DUMMY_ADDRESS)],
        ]), [], WalletType.BIP39),
    new WalletInfo('joyful-cat', 'Ledger',
        new Map<string, AccountInfo>([
            ['NQ07 0000 0000 0000 0000 0000 0000 0000 0000', new AccountInfo('m/0\'', 'MyLedger', DUMMY_ADDRESS)],
        ]), [{
            address: DUMMY_ADDRESS,
            label: 'Savings',
            ownerPath: 'm/0\'',
            type: ContractType.VESTING,
        }], WalletType.LEDGER),
    new WalletInfo('sad-panda', 'Old',
        new Map<string, AccountInfo>([
            ['NQ07 0000 0000 0000 0000 0000 0000 0000 0000', new AccountInfo('m/0\'', 'OldAddress', DUMMY_ADDRESS)],
        ]), [], WalletType.LEGACY),
];

const beforeEachCallback = async () => {
    WalletStore.INDEXEDDB_IMPLEMENTATION = indexedDB;
    await Promise.all(DUMMY.map(WalletStore.Instance.put.bind(WalletStore.Instance)));
    await WalletStore.Instance.close();
};

const afterEachCallback = async () => {
    await WalletStore.Instance.close();
    await new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(WalletStore.DB_NAME);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(true);
        request.onblocked = () => {
            // wait for open connections to get closed
            setTimeout(() => reject(new Error('Can\'t delete database, there is still an open connection.')), 1000);
        };
    });
    // delete WalletStore.instance;
};

describe('WalletStore', () => {

    beforeEach(beforeEachCallback);

    afterEach(afterEachCallback);

    it('is a singleton', () => {
        const instance1 = WalletStore.Instance;
        const instance2 = WalletStore.Instance;
        expect(instance1).toBe(instance2);
    });

    it('can get plain account infos', async () => {
        const [key1, key2, key3] = await Promise.all([
            WalletStore.Instance.get(DUMMY[0].id),
            WalletStore.Instance.get(DUMMY[1].id),
            WalletStore.Instance.get(DUMMY[2].id),
        ]);
        expect(key1).toEqual(DUMMY[0]);
        expect(key2).toEqual(DUMMY[1]);
        expect(key3).toEqual(DUMMY[2]);
    });

    it('can list keys', async () => {
        const keys = await WalletStore.Instance.list();
        expect(keys).toEqual(DUMMY.map((wi) => wi.toObject()));
    });

    it('can remove keys', async () => {
        let currentKeys = await WalletStore.Instance.list();
        expect(currentKeys.length).toBe(3);

        await WalletStore.Instance.remove(DUMMY[1].id);
        currentKeys = await WalletStore.Instance.list();
        expect(currentKeys.length).toBe(2);
        expect(currentKeys[1].id).not.toBe(DUMMY[1].id);

        // check that we can't get a removed key by id
        const removedKey = await WalletStore.Instance.get(DUMMY[1].id);
        expect(removedKey).toBeUndefined();
    });

    it('can add and update keys', async () => {
        // first clear database
        await afterEachCallback();

        let currentPermissions = await WalletStore.Instance.list();
        expect(currentPermissions.length).toBe(0);

        // add permissions
        await WalletStore.Instance.put(DUMMY[1]);
        currentPermissions = await WalletStore.Instance.list();
        expect(currentPermissions.length).toBe(1);

        // check that the key info has been stored correctly
        let keyInfo = await WalletStore.Instance.get(DUMMY[1].id);
        expect(keyInfo).toEqual(DUMMY[1]);

        keyInfo!.contracts.pop();
        keyInfo!.accounts.set('m/1\'', new AccountInfo('m/1\'', 'Test', DUMMY_ADDRESS));

        // Update the key
        await WalletStore.Instance.put(keyInfo!);

        // Check that the info have been updated correctly
        keyInfo = await WalletStore.Instance.get(DUMMY[1].id);
        expect(keyInfo).toBeDefined();
        expect(keyInfo!.contracts.length).toBe(0);
        expect(keyInfo!.accounts.size).toBe(2);
        expect(keyInfo!.accounts.get('m/1\'')).toBeDefined();
        expect(keyInfo!.accounts.get('m/1\'')!.path).toBe('m/1\'');
    });
});
