import { NetworkClient } from '@nimiq/network-client';
import { KeyguardClient } from '@nimiq/keyguard-client';
import { AccountInfo } from '@/lib/AccountInfo';
import { WalletStore } from '@/lib/WalletStore';
import { WalletInfo, WalletType } from '@/lib/WalletInfo';
import LazyLoading from '@/lib/LazyLoading';

type BasicAccountInfo = { // tslint:disable-line:interface-over-type-literal
    address: string,
    path: string,
};

export default class WalletInfoCollector {
    public static async collectWalletInfo(
        walletType: WalletType,
        walletId?: string,
        initialAccounts?: BasicAccountInfo[],
        onIntermediateResult?: (walletInfo: WalletInfo) => void,
    ): Promise<WalletInfo> {
        // Kick off loading dependencies
        WalletInfoCollector._initializeDependencies(walletType);

        // Kick off first round of account derivation
        let startIndex = 0;
        let derivedAccountsPromise;
        if (walletType !== WalletType.LEGACY) {
            derivedAccountsPromise = WalletInfoCollector._deriveAccounts(startIndex,
                WalletInfoCollector.MAX_ALLOWED_GAP, walletType, walletId);

            // For Ledger wallet compute the wallet id from first derived account
            if (walletType === WalletType.LEDGER) {
                const derivedAccounts = await derivedAccountsPromise;
                walletId = await WalletInfoCollector._computeLedgerWalletId(derivedAccounts[0].address);
            }
        }

        // Get or create the walletInfo instance
        if (!walletId) {
            throw new Error('walletId needed for WalletTypes other than Ledger.');
        }
        const walletInfo = await WalletInfoCollector._getWalletInfoInstance(walletId, walletType);

        // Add initial accounts to the walletInfo
        let initialAccountsPromise;
        if (initialAccounts) {
            WalletInfoCollector._addAccounts(walletInfo, initialAccounts, undefined, onIntermediateResult);
            // after fetching balances, update again
            initialAccountsPromise = WalletInfoCollector._getBalances(initialAccounts).then((balances) =>
                WalletInfoCollector._addAccounts(walletInfo, initialAccounts, balances, onIntermediateResult));
        } else {
            initialAccountsPromise = Promise.resolve();
        }

        if (walletType === WalletType.LEGACY) {
            // legacy wallets have no derived accounts
            await initialAccountsPromise;
            return walletInfo;
        }

        let didFindAccounts;
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
            startIndex += WalletInfoCollector.MAX_ALLOWED_GAP;
            derivedAccountsPromise = WalletInfoCollector._deriveAccounts(startIndex,
                WalletInfoCollector.MAX_ALLOWED_GAP, walletType, walletId);

            // find accounts with a balance > 0
            didFindAccounts = false;
            // TODO should use transaction receipts
            const balances = await WalletInfoCollector._getBalances(derivedAccounts!);
            const usedAccounts: BasicAccountInfo[] = [];
            for (const account of derivedAccounts!) {
                const balance = balances.get(account.address);
                if (balance === undefined || balance === 0) continue;
                usedAccounts.push(account);
                didFindAccounts = true;
            }
            if (didFindAccounts) {
                WalletInfoCollector._addAccounts(walletInfo, usedAccounts, balances, onIntermediateResult);
            }
        } while (didFindAccounts);

        if (walletType === WalletType.BIP39 && WalletInfoCollector._keyguardClient) {
            WalletInfoCollector._keyguardClient.releaseKey(walletId);
        }

        await initialAccountsPromise; // make sure initial accounts balances are updated
        return walletInfo;
    }

    // TODO move to constants
    private static readonly MAX_ALLOWED_GAP = 20;
    private static readonly KEYGUARD_SLIP0010_BASE_PATH = `m/44'/242'/0'/`;
    private static readonly DEFAULT_LABEL_LEGACY_WALLET = 'Legacy Wallet';
    private static readonly DEFAULT_LABEL_KEYGUARD_WALLET = 'Keyguard Wallet';
    private static readonly DEFAULT_LABEL_LEDGER_WALLET = 'Ledger Wallet';
    private static readonly DEFAULT_LABEL_KEYGUARD_ACCOUNT = 'Standard Account';
    private static readonly DEFAULT_LABEL_LEDGER_ACCOUNT = 'Ledger Account';
    private static _keyguardClient?: KeyguardClient; // TODO avoid the need to create another KeyguardClient here
    private static _networkInitializationPromise?: Promise<void>;
    private static _wasmInitializationPromise?: Promise<void>;

    private static _initializeDependencies(walletType: WalletType) {
        WalletInfoCollector._networkInitializationPromise =
            WalletInfoCollector._networkInitializationPromise || NetworkClient.Instance.init();
        if (walletType === WalletType.BIP39) {
            WalletInfoCollector._keyguardClient = WalletInfoCollector._keyguardClient || new KeyguardClient();
        } else if (walletType === WalletType.LEDGER) {
            WalletInfoCollector._wasmInitializationPromise =
                WalletInfoCollector._wasmInitializationPromise || LazyLoading.loadNimiq(true);
        }
    }

    private static async _getWalletInfoInstance(walletId: string, walletType: WalletType) {
        const existingWalletInfo = await WalletStore.Instance.get(walletId);
        if (existingWalletInfo) return existingWalletInfo;
        const label = walletType === WalletType.LEGACY
            ? WalletInfoCollector.DEFAULT_LABEL_LEGACY_WALLET
            : walletType === WalletType.BIP39
                ? WalletInfoCollector.DEFAULT_LABEL_KEYGUARD_WALLET
                : WalletInfoCollector.DEFAULT_LABEL_LEDGER_WALLET;
        return new WalletInfo(
            walletId,
            label,
            new Map<string, AccountInfo>(),
            [],
            walletType,
            false,
        );
    }

    private static async _deriveAccounts(startIndex: number, count: number, walletType: WalletType, walletId?: string) {
        if (walletType === WalletType.LEGACY) {
            throw new Error('Legacy Wallets can not derive accounts.');
        } else if (walletType === WalletType.BIP39) {
            if (!walletId) throw new Error('walletId needed for Keyguard account derivation.');
            return WalletInfoCollector._deriveKeyguardAccounts(startIndex, count, walletId);
        } else if (walletType === WalletType.LEDGER) {
            throw new Error('Ledger account derivation not implemented yet.');
        } else {
            throw new Error('Unsupported walletType.');
        }
    }

    private static async _deriveKeyguardAccounts(startIndex: number, count: number, walletId: string) {
        const pathsToDerive = [];
        for (let keyId = startIndex; keyId < startIndex + count; ++keyId) {
            pathsToDerive.push(`${WalletInfoCollector.KEYGUARD_SLIP0010_BASE_PATH}${keyId}'`);
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

    private static async _computeLedgerWalletId(firstAccountAddress: string) {
        // calculate wallet id deterministically from first account similarly to legacy wallets in Key.js in Keyguard
        await WalletInfoCollector._wasmInitializationPromise;
        const input = Nimiq.Address.fromUserFriendlyAddress(firstAccountAddress).serialize();
        return Nimiq.BufferUtils.toHex(Nimiq.Hash.blake2b(input).subarray(0, 6));
    }

    private static async _getBalances(accounts: BasicAccountInfo[]) {
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
        onIntermediateResult?: (walletInfo: WalletInfo) => void,
    ) {
        for (const newAccount of newAccounts) {
            const existingAccountInfo = walletInfo.accounts.get(newAccount.address);
            const balance = balances ? balances.get(newAccount.address) : undefined;
            const accountInfo = existingAccountInfo || new AccountInfo(
                newAccount.path,
                walletInfo.type === WalletType.LEDGER
                    ? WalletInfoCollector.DEFAULT_LABEL_LEDGER_ACCOUNT
                    : WalletInfoCollector.DEFAULT_LABEL_KEYGUARD_ACCOUNT,
                Nimiq.Address.fromUserFriendlyAddress(newAccount.address),
            );
            if (balance !== undefined) accountInfo.balance = balance;
            walletInfo.accounts.set(newAccount.address, accountInfo);
        }
        if (onIntermediateResult) onIntermediateResult(walletInfo);
    }
}
