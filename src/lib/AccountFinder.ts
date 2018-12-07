import { AccountInfo } from '@/lib/AccountInfo';
import { NetworkClient } from '@nimiq/network-client';
import { WalletStore } from '@/lib/WalletStore';

export default class AccountFinder {
    public static async findAccounts(
        deriveAccounts: (startIndex: number, count: number) => Promise<Array<{ address: string, keyPath: string }>>,
        deriveWalletId: (accounts: Array<{ address: string, keyPath: string, balance: number }>) => Promise<string>,
        defaultLabel: string = 'Standard Account',
        onIntermediateResult?: (accounts: Array<{ address: string, keyPath: string, balance: number }>) => void,
    ): Promise<AccountInfo[]> {
        await NetworkClient.Instance.init(); // initialize NetworkClient if not initialized yet
        const foundAccounts: Array<{ address: string, keyPath: string, balance: number }> = [];
        let nextStartIndex = 0;
        let derivedAccountsPromise = deriveAccounts(nextStartIndex, AccountFinder.MAX_ALLOWED_GAP);
        nextStartIndex += AccountFinder.MAX_ALLOWED_GAP;
        while (true) {
            const derivedAccounts = await derivedAccountsPromise;
            if (derivedAccounts.length !== AccountFinder.MAX_ALLOWED_GAP) {
                throw new Error('\'deriveAccounts\' returned wrong number of accounts');
            }

            // already start deriving next accounts
            derivedAccountsPromise = deriveAccounts(nextStartIndex, AccountFinder.MAX_ALLOWED_GAP);
            nextStartIndex += derivedAccounts.length; // by always advancing in blocks of MAX_ALLOWED_GAP it can happen
            // that we include accounts that are more than MAX_ALLOWED_GAP apart (e.g. one towards the beginning of
            // the first block, the other one towards the end of the second block). But that's actually not bad.

            // find accounts with a balance > 0
            // TODO should use transaction receipts combined with balance
            let didFindAccounts = false;
            const userFriendlyAddresses = derivedAccounts.map(({ address }) => address);
            const balances = await NetworkClient.Instance.getBalance(userFriendlyAddresses);
            for (const account of derivedAccounts) {
                const balance = balances.get(account.address);
                if (balance === undefined || balance === 0) continue;
                foundAccounts.push(Object.assign({}, account, { balance }));
                didFindAccounts = true;
            }

            if (!didFindAccounts) break;
            if (onIntermediateResult) onIntermediateResult(foundAccounts);
        }

        // check for existing labels
        const walletId = await deriveWalletId(foundAccounts);
        const walletInfo = await WalletStore.Instance.get(walletId);
        const existingAccounts: Map<string, AccountInfo> = walletInfo ? walletInfo.accounts : new Map();
        return foundAccounts.map((account) => new AccountInfo(
            account.keyPath,
            existingAccounts.has(account.address) ? existingAccounts.get(account.address)!.label : defaultLabel,
            Nimiq.Address.fromUserFriendlyAddress(account.address),
            Nimiq.Policy.coinsToSatoshis(account.balance),
        ));
    }

    private static readonly MAX_ALLOWED_GAP = 20;
}
