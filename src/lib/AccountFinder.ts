import { AccountInfo } from '@/lib/AccountInfo';
import { NetworkClient } from '@nimiq/network-client';
import { WalletStore } from '@/lib/WalletStore';

export default class AccountFinder {
    public static async findAccounts(
        deriveAccounts: (startIndex: number, count: number) => Promise<Array<{ address: string, path: string }>>,
        deriveWalletId: (firstAccount: { address: string, path: string }) => Promise<string>,
        defaultLabel: string = 'Standard Account', // TODO move constant to a Constants class / file
        onIntermediateResult?: (accounts: AccountInfo[]) => void,
    ): Promise<AccountInfo[]> {
        await NetworkClient.Instance.init(); // initialize NetworkClient if not initialized yet
        const foundAccounts: AccountInfo[] = [];
        let nextStartIndex = 0;
        let derivedAccountsPromise = deriveAccounts(nextStartIndex, AccountFinder.MAX_ALLOWED_GAP);
        nextStartIndex += AccountFinder.MAX_ALLOWED_GAP;

        // calculate walletId (potentially using the first account) and read existing accounts
        const existingAccountsPromise = derivedAccountsPromise
            .then((derivedAccounts) => deriveWalletId(derivedAccounts[0]))
            .then((walletId) => WalletStore.Instance.get(walletId))
            .then((walletInfo) => walletInfo ? walletInfo.accounts : new Map<string, AccountInfo>());

        let didFindAccounts;
        do {
            const derivedAccounts = await derivedAccountsPromise;
            if (derivedAccounts.length !== AccountFinder.MAX_ALLOWED_GAP) {
                throw new Error('\'deriveAccounts\' returned wrong number of accounts');
            }

            // already start deriving next accounts
            derivedAccountsPromise = deriveAccounts(nextStartIndex, AccountFinder.MAX_ALLOWED_GAP);
            nextStartIndex += derivedAccounts.length; // by always advancing in blocks of MAX_ALLOWED_GAP it can happen
            // that we include accounts that are more than MAX_ALLOWED_GAP apart (e.g. one account at index 0, the other
            // one at index 39). But while this does not exactly follow the specification, it's actually good for the
            // user, as we'll potentially find more of the user's accounts. For example, if the user adds the accounts
            // derived with indices 0, 19, 39 to his wallet but then only ends up using accounts 0 and 39, the account
            // at index 19 will not be found anymore on reimport. With the current implementation however, at least the
            // account 39 would be found, while an implementation strictly following the specification would stop the
            // search at index 20.

            // find accounts with a balance > 0
            didFindAccounts = false;
            // TODO should use transaction receipts
            const userFriendlyAddresses = derivedAccounts.map((account) => account.address);
            const balances = await NetworkClient.Instance.getBalance(userFriendlyAddresses);
            for (const account of derivedAccounts) {
                const balance = balances.get(account.address);
                if (balance === undefined || balance === 0) continue;
                const accountInfo = (await existingAccountsPromise).get(account.address) || new AccountInfo(
                    account.path,
                    defaultLabel,
                    Nimiq.Address.fromUserFriendlyAddress(account.address),
                );
                accountInfo.balance = Nimiq.Policy.coinsToSatoshis(balance);
                foundAccounts.push(accountInfo);
                didFindAccounts = true;
            }

            if (didFindAccounts && onIntermediateResult) onIntermediateResult(foundAccounts);
        } while (didFindAccounts);
        return foundAccounts;
    }

    private static readonly MAX_ALLOWED_GAP = 20;
}
