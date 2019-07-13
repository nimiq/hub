import { setup } from './_setup';
import { WalletInfo, WalletType } from '@/lib/WalletInfo';
import { Store } from '@/lib/Store';
import { WalletStore } from '@/lib/WalletStore';
import { AccountInfo } from '@/lib/AccountInfo';
import { VestingContractInfo, HashedTimeLockedContractInfo } from '@/lib/ContractInfo';

setup();

const indexedDB: IDBFactory = require('fake-indexeddb'); // tslint:disable-line:no-var-requires

// @ts-ignore private field access
Store.INDEXEDDB_IMPLEMENTATION = indexedDB;

const DUMMY_ADDRESS = Nimiq.Address.fromUserFriendlyAddress('NQ07 0000 0000 0000 0000 0000 0000 0000 0000');
const DUMMY: WalletInfo[] = [ // IDs must be alphabetically ordered, as the WalletStore uses the id as the primary index
    new WalletInfo('1ae56b44c65d', 'D+YGexOP0yDjr3Uf6WwO9a2/WjhNbZFLrRwdLfuvz9c=', 'Old',
        new Map<string, AccountInfo>([
            ['NQ07 0000 0000 0000 0000 0000 0000 0000 0000', new AccountInfo('m/0\'', 'OldAddress', DUMMY_ADDRESS)],
        ]), [new VestingContractInfo(
            'Savings',
            Nimiq.Address.fromUserFriendlyAddress('NQ07 0000 0000 0000 0000 0000 0000 0000 0000'),
            Nimiq.Address.fromUserFriendlyAddress('NQ07 0000 0000 0000 0000 0000 0000 0000 0000'),
            0, 1500000, 120000, 3000000,
        )], WalletType.LEGACY),
    new WalletInfo('57e1380cd0e2', 'KXi/KbN35+oYAIV2ummFjLWxfY/47fo/35Hfa3WNVA0=', 'Main',
        new Map<string, AccountInfo>([
            ['NQ07 0000 0000 0000 0000 0000 0000 0000 0000', new AccountInfo('m/0\'', 'MyAccount', DUMMY_ADDRESS)],
        ]), [], WalletType.BIP39),
    new WalletInfo('7a8616a79027', 'LsYVUikGJA5z8p37+LqkH3EZ5opDz2zQRT1r8cGJ8dE=', 'Ledger',
        new Map<string, AccountInfo>([
            ['NQ07 0000 0000 0000 0000 0000 0000 0000 0000', new AccountInfo('m/0\'', 'MyLedger', DUMMY_ADDRESS)],
        ]), [new HashedTimeLockedContractInfo(
            'Agora.Trade HTLC',
            Nimiq.Address.fromUserFriendlyAddress('NQ07 0000 0000 0000 0000 0000 0000 0000 0000'),
            Nimiq.Address.fromUserFriendlyAddress('NQ07 0000 0000 0000 0000 0000 0000 0000 0000'),
            Nimiq.Address.fromUserFriendlyAddress('NQ07 0000 0000 0000 0000 0000 0000 0000 0000'),
            new Nimiq.Hash(Nimiq.BufferUtils
                .fromHex('0000000000000000000000000000000000000000000000000000000000000000')
                .subarray(0, 32)),
            1, 120, 3000e5,
        )], WalletType.LEDGER),
];
const DUMMY_SALT = new Uint8Array(WalletStore.SALT_LENGTH);

const beforeEachCallback = async () => {
    await Promise.all(DUMMY.map((wallet) => WalletStore.Instance.put(wallet)));
    // @ts-ignore private method call
    await WalletStore.Instance._putMetaData('salt', DUMMY_SALT);
    await WalletStore.Instance.close();
};

const afterEachCallback = async () => {
    await WalletStore.Instance.close();
    await new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(WalletStore.Instance.getConstants().DB_NAME);
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
        const [key0, key1, key2] = await Promise.all([
            WalletStore.Instance.get(DUMMY[0].id),
            WalletStore.Instance.get(DUMMY[1].id),
            WalletStore.Instance.get(DUMMY[2].id),
        ]);
        expect(key0).toEqual(DUMMY[0]);
        expect(key1).toEqual(DUMMY[1]);
        expect(key2).toEqual(DUMMY[2]);
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

    it('can derive correct id from keyId', async () => {
        const vectors = [
            {
                // New keyId
                keyId: 'pYMqO5SJxFRrb6EKBOf1vH7vcbqzcIyCZ2U3L//fWPo=',
                accountId: '655884d15860',
            },
            {
                // Existing keyId
                keyId: 'KXi/KbN35+oYAIV2ummFjLWxfY/47fo/35Hfa3WNVA0=',
                accountId: '57e1380cd0e2',
            },
        ];

        for (const vector of vectors) {
            const id = await WalletStore.Instance.deriveId(vector.keyId);
            expect(id).toBe(vector.accountId);
        }
    });
});
