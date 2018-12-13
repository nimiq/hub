import { NetworkClient } from '@nimiq/network-client';
import { KeyguardClient } from '@nimiq/keyguard-client';
import { AccountInfo } from '@/lib/AccountInfo';
import { WalletStore } from '@/lib/WalletStore';
import { WalletInfo, WalletType } from '@/lib/WalletInfo';
import {
    KEYGUARD_SLIP0010_BASE_PATH,
    MAX_ALLOWED_GAP,
    DEFAULT_LABEL_LEGACY_WALLET,
    DEFAULT_LABEL_KEYGUARD_WALLET,
    DEFAULT_LABEL_LEDGER_WALLET,
    DEFAULT_LABEL_KEYGUARD_ACCOUNT,
    DEFAULT_LABEL_LEDGER_ACCOUNT,
} from '../lib/Constants';

type BasicAccountInfo = { // tslint:disable-line:interface-over-type-literal
    address: string,
    path: string,
};

export default class WalletInfoCollector {
    public static async collectWalletInfo(
        walletType: WalletType,
        walletId?: string,
        initialAccounts?: BasicAccountInfo[],
        onUpdate?: (walletInfo: WalletInfo) => void,
    ): Promise<WalletInfo> {
        // Kick off loading dependencies
        WalletInfoCollector._initializeDependencies(walletType);

        // Kick off first round of account derivation
        let startIndex = 0;
        let derivedAccountsPromise;
        if (walletType !== WalletType.LEGACY) {
            derivedAccountsPromise = WalletInfoCollector._deriveAccounts(startIndex,
                MAX_ALLOWED_GAP, walletType, walletId);

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
            WalletInfoCollector._addAccounts(walletInfo, initialAccounts, undefined, onUpdate);
            // after fetching balances, update again
            initialAccountsPromise = WalletInfoCollector._getBalances(initialAccounts).then((balances) =>
                WalletInfoCollector._addAccounts(walletInfo, initialAccounts, balances, onUpdate));
        } else {
            initialAccountsPromise = Promise.resolve();
        }

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
            startIndex += MAX_ALLOWED_GAP;
            derivedAccountsPromise = WalletInfoCollector._deriveAccounts(startIndex,
                MAX_ALLOWED_GAP, walletType, walletId);

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
                WalletInfoCollector._addAccounts(walletInfo, foundAccounts, balances, onUpdate);
            }
        } while (foundAccounts.length > 0);

        if (walletType === WalletType.BIP39 && WalletInfoCollector._keyguardClient) {
            WalletInfoCollector._keyguardClient.releaseKey(walletId);
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
                WalletInfoCollector._wasmInitializationPromise || Nimiq.WasmHelper.doImportBrowser();
            WalletInfoCollector._wasmInitializationPromise
                .catch(() => delete WalletInfoCollector._wasmInitializationPromise);
        }
    }

    private static async _getWalletInfoInstance(walletId: string, walletType: WalletType): Promise<WalletInfo> {
        const existingWalletInfo = await WalletStore.Instance.get(walletId);
        if (existingWalletInfo) return existingWalletInfo;
        const label = walletType === WalletType.LEGACY
            ? DEFAULT_LABEL_LEGACY_WALLET
            : walletType === WalletType.BIP39
                ? DEFAULT_LABEL_KEYGUARD_WALLET
                : DEFAULT_LABEL_LEDGER_WALLET;
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
                throw new Error('Ledger account derivation not implemented yet.');
            default:
                throw new Error('Unsupported walletType.');
        }
    }

    private static async _deriveKeyguardAccounts(startIndex: number, count: number, walletId: string)
        : Promise<BasicAccountInfo[]> {
        const pathsToDerive = [];
        for (let keyId = startIndex; keyId < startIndex + count; ++keyId) {
            pathsToDerive.push(`${KEYGUARD_SLIP0010_BASE_PATH}/${keyId}'`);
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

    private static async _computeLedgerWalletId(firstAccountAddress: string): Promise<string> {
        // calculate wallet id deterministically from first account similarly to legacy wallets in Key.js in Keyguard
        await WalletInfoCollector._wasmInitializationPromise;
        const input = Nimiq.Address.fromUserFriendlyAddress(firstAccountAddress).serialize();
        return Nimiq.BufferUtils.toHex(Nimiq.Hash.blake2b(input).subarray(0, 6));
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
        onUpdate?: (walletInfo: WalletInfo) => void,
    ): void {
        for (const newAccount of newAccounts) {
            const existingAccountInfo = walletInfo.accounts.get(newAccount.address);
            const balance = balances ? balances.get(newAccount.address) : undefined;
            const accountInfo = existingAccountInfo || new AccountInfo(
                newAccount.path,
                walletInfo.type === WalletType.LEDGER
                    ? DEFAULT_LABEL_LEDGER_ACCOUNT
                    : DEFAULT_LABEL_KEYGUARD_ACCOUNT,
                Nimiq.Address.fromUserFriendlyAddress(newAccount.address),
            );
            if (balance !== undefined) accountInfo.balance = balance;
            walletInfo.accounts.set(newAccount.address, accountInfo);
        }
        if (onUpdate) onUpdate(walletInfo);
    }
}
