import { NetworkClient } from '@nimiq/network-client';
import { KeyguardClient } from '@nimiq/keyguard-client';
import { AccountInfo } from '@/lib/AccountInfo';
import { WalletStore } from '@/lib/WalletStore';
import { WalletInfo, WalletType } from '@/lib/WalletInfo';
import LedgerApi from '@/lib/LedgerApi'; // TODO import LedgerApi only when needed
import { ACCOUNT_DEFAULT_LABEL_KEYGUARD, ACCOUNT_DEFAULT_LABEL_LEDGER, WALLET_DEFAULT_LABEL_KEYGUARD,
    WALLET_DEFAULT_LABEL_LEDGER, WALLET_DEFAULT_LABEL_LEGACY, WALLET_MAX_ALLOWED_ACCOUNT_GAP,
    WALLET_BIP32_BASE_PATH_KEYGUARD } from '@/lib/Constants';

type BasicAccountInfo = { // tslint:disable-line:interface-over-type-literal
    address: string,
    path: string,
};

export default class WalletInfoCollector {
    public static async collectWalletInfo(
        walletType: WalletType,
        walletId?: string,
        initialAccounts?: BasicAccountInfo[],
        // tslint:disable-next-line:no-empty
        onUpdate: (walletInfo: WalletInfo, currentlyCheckedAccounts: BasicAccountInfo[]) => void = () => {},
    ): Promise<WalletInfo> {
        // Kick off loading dependencies
        WalletInfoCollector._initializeDependencies(walletType);

        // Kick off first round of account derivation
        let startIndex = 0;
        let derivedAccountsPromise: Promise<BasicAccountInfo[]>;
        if (walletType === WalletType.LEGACY) {
            derivedAccountsPromise = Promise.resolve([]);
        } else {
            derivedAccountsPromise = WalletInfoCollector._deriveAccounts(startIndex,
                WALLET_MAX_ALLOWED_ACCOUNT_GAP, walletType, walletId);

            // for ledger, we retrieve the walletId from the currently connected ledger
            if (walletType === WalletType.LEDGER && !walletId) {
                walletId = await LedgerApi.getWalletId();
            }
        }

        // Get or create the walletInfo instance
        if (!walletId) {
            throw new Error('walletId needed for WalletTypes other than Ledger.');
        }
        const walletInfo = await WalletInfoCollector._getWalletInfoInstance(walletId, walletType);

        // Add initial accounts to the walletInfo
        let initialAccountsPromise;
        if (initialAccounts && initialAccounts.length > 0) {
            WalletInfoCollector._addAccounts(walletInfo, initialAccounts, undefined);
            // fetch balances and update again
            initialAccountsPromise = WalletInfoCollector._getBalances(initialAccounts).then(async (balances) => {
                WalletInfoCollector._addAccounts(walletInfo, initialAccounts, balances);
                onUpdate(walletInfo, await derivedAccountsPromise);
            });
        } else {
            initialAccountsPromise = Promise.resolve();
        }
        onUpdate(walletInfo, await derivedAccountsPromise);

        if (walletType === WalletType.LEGACY) {
            // legacy wallets have no derived accounts
            await initialAccountsPromise;
            return walletInfo;
        }

        let foundAccounts: BasicAccountInfo[];
        do {
            const derivedAccounts = await derivedAccountsPromise;

            // already start deriving next accounts
            // By always advancing in groups of MAX_ALLOWED_GAP addresses per round, it often happens that more
            // addresses are derived and checked for activity than the BIP44 address gap limit
            // (https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki#address-gap-limit) stipulates, because
            // whenever an active address in a group of addresses is found, the next full group is also derived. Thus
            // the actual gap limit of this implementation is up to (2 x MAX_ALLOWED_GAP) - 1.
            // We argue that this is good UX for users, as potentially more of their active addresses are found, even
            // if they haven't strictly followed to the standard - at only a relatively small cost to the network.
            // For example, if the user adds the accounts derived with indices 0, 19, 39 to his wallet but then only
            // ends up using accounts 0 and 39, the account at index 19 will not be found anymore on reimport. With the
            // current implementation however, at least the account 39 would be found, while an implementation strictly
            // following the specification would stop the search at index 20.
            startIndex += WALLET_MAX_ALLOWED_ACCOUNT_GAP;
            derivedAccountsPromise = WalletInfoCollector._deriveAccounts(startIndex,
                WALLET_MAX_ALLOWED_ACCOUNT_GAP, walletType, walletId);

            // find accounts with a balance > 0
            // TODO should use transaction receipts
            foundAccounts = [];
            const balances = await WalletInfoCollector._getBalances(derivedAccounts!);
            for (const account of derivedAccounts!) {
                const balance = balances.get(account.address);
                if (balance === undefined || balance === 0) continue;
                foundAccounts.push(account);
            }
            if (foundAccounts.length > 0) {
                WalletInfoCollector._addAccounts(walletInfo, foundAccounts, balances);
                onUpdate(walletInfo, derivedAccounts);
            }
        } while (foundAccounts.length > 0);

        // clean up
        if (walletType === WalletType.BIP39 && WalletInfoCollector._keyguardClient) {
            WalletInfoCollector._keyguardClient.releaseKey(walletId);
        } else if (walletType === WalletType.LEDGER && LedgerApi.currentRequest
            && LedgerApi.currentRequest.type === LedgerApi.RequestType.DERIVE_ACCOUNTS) {
            // next round of derivation still going on although we don't need it
            derivedAccountsPromise.catch(() => undefined); // to avoid uncaught promise rejection for cancel
            derivedAccountsPromise = Promise.resolve([]); // for if the initial balance onUpdate did not fire yet
            LedgerApi.currentRequest.cancel();
        }

        await initialAccountsPromise; // make sure initial accounts balances are updated
        return walletInfo;
    }

    private static _keyguardClient?: KeyguardClient; // TODO avoid the need to create another KeyguardClient here
    private static _networkInitializationPromise?: Promise<void>;
    private static _wasmInitializationPromise?: Promise<void>;

    private static _initializeDependencies(walletType: WalletType): void {
        WalletInfoCollector._networkInitializationPromise =
            WalletInfoCollector._networkInitializationPromise || NetworkClient.Instance.init();
        WalletInfoCollector._networkInitializationPromise
            .catch(() => delete WalletInfoCollector._networkInitializationPromise);
        if (walletType === WalletType.BIP39) {
            WalletInfoCollector._keyguardClient = WalletInfoCollector._keyguardClient || new KeyguardClient();
        } else if (walletType === WalletType.LEDGER) {
            WalletInfoCollector._wasmInitializationPromise =
                WalletInfoCollector._wasmInitializationPromise || Nimiq.WasmHelper.doImport();
            WalletInfoCollector._wasmInitializationPromise
                .catch(() => delete WalletInfoCollector._wasmInitializationPromise);
        }
    }

    private static async _getWalletInfoInstance(walletId: string, walletType: WalletType): Promise<WalletInfo> {
        const existingWalletInfo = await WalletStore.Instance.get(walletId);
        if (existingWalletInfo) return existingWalletInfo;
        const label = walletType === WalletType.LEGACY
            ? WALLET_DEFAULT_LABEL_LEGACY
            : walletType === WalletType.BIP39
                ? WALLET_DEFAULT_LABEL_KEYGUARD
                : WALLET_DEFAULT_LABEL_LEDGER;
        return new WalletInfo(
            walletId,
            label,
            new Map<string, AccountInfo>(),
            [],
            walletType,
            false,
        );
    }

    private static async _deriveAccounts(startIndex: number, count: number, walletType: WalletType, walletId?: string)
        : Promise<BasicAccountInfo[]> {
        switch (walletType) {
            case WalletType.LEGACY:
                throw new Error('Legacy Wallets can not derive accounts.');
            case WalletType.BIP39:
                if (!walletId) throw new Error('walletId needed for Keyguard account derivation.');
                return WalletInfoCollector._deriveKeyguardAccounts(startIndex, count, walletId);
            case WalletType.LEDGER:
                return WalletInfoCollector._deriveLedgerAccounts(startIndex, count);
            default:
                throw new Error('Unsupported walletType.');
        }
    }

    private static async _deriveKeyguardAccounts(startIndex: number, count: number, walletId: string)
        : Promise<BasicAccountInfo[]> {
        const pathsToDerive = [];
        for (let keyId = startIndex; keyId < startIndex + count; ++keyId) {
            pathsToDerive.push(`${WALLET_BIP32_BASE_PATH_KEYGUARD}${keyId}'`);
        }
        const serializedAddresses = await WalletInfoCollector._keyguardClient!.deriveAddresses(walletId, pathsToDerive);
        const userFriendlyAddresses = serializedAddresses.map((serializedAddress) =>
            new Nimiq.Address(serializedAddress).toUserFriendlyAddress());
        const accounts = [];
        for (let i = 0; i < pathsToDerive.length; ++i) {
            accounts.push({
                path: pathsToDerive[i],
                address: userFriendlyAddresses[i],
            });
        }
        return accounts;
    }

    private static async _deriveLedgerAccounts(startIndex: number, count: number): Promise<BasicAccountInfo[]> {
        const pathsToDerive = [];
        for (let keyId = startIndex; keyId < startIndex + count; ++keyId) {
            pathsToDerive.push(LedgerApi.getBip32PathForKeyId(keyId));
        }
        return (await LedgerApi.deriveAccounts(pathsToDerive)).map((account) => ({
            path: account.keyPath,
            address: account.address,
        }));
    }

    private static async _getBalances(accounts: BasicAccountInfo[]): Promise<Map<string, number>> {
        const userFriendlyAddresses = accounts.map((account) => account.address);
        await WalletInfoCollector._networkInitializationPromise;
        const balances = await NetworkClient.Instance.getBalance(userFriendlyAddresses);
        for (const [address, balance] of balances) {
            balances.set(address, Nimiq.Policy.coinsToSatoshis(balance));
        }
        return balances;
    }

    private static _addAccounts(
        walletInfo: WalletInfo,
        newAccounts: BasicAccountInfo[],
        balances?: Map<string, number>,
    ): void {
        for (const newAccount of newAccounts) {
            const existingAccountInfo = walletInfo.accounts.get(newAccount.address);
            const balance = balances ? balances.get(newAccount.address) : undefined;
            const accountInfo = existingAccountInfo || new AccountInfo(
                newAccount.path,
                walletInfo.type === WalletType.LEDGER
                    ? ACCOUNT_DEFAULT_LABEL_LEDGER
                    : ACCOUNT_DEFAULT_LABEL_KEYGUARD,
                Nimiq.Address.fromUserFriendlyAddress(newAccount.address),
            );
            if (balance !== undefined) accountInfo.balance = balance;
            walletInfo.accounts.set(newAccount.address, accountInfo);
        }
    }
}
