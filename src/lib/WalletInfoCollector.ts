import { NetworkClient } from '@nimiq/network-client';
import { KeyguardClient, SimpleResult as KeyguardSimpleResult } from '@nimiq/keyguard-client';
import { AccountInfo } from '@/lib/AccountInfo';
import { WalletStore } from '@/lib/WalletStore';
import { WalletInfo, WalletType } from '@/lib/WalletInfo';
import LedgerApi from '@/lib/LedgerApi'; // TODO import LedgerApi only when needed
import {
    ACCOUNT_BIP32_BASE_PATH_KEYGUARD,
    ACCOUNT_DEFAULT_LABEL_LEDGER,
    ACCOUNT_DEFAULT_LABEL_LEGACY,
    ACCOUNT_MAX_ALLOWED_ADDRESS_GAP,
    ACCOUNT_TEMPORARY_LABEL_KEYGUARD,
    CONTRACT_DEFAULT_LABEL_VESTING,
} from '@/lib/Constants';
import Config from 'config';
import { ERROR_TRANSACTION_RECEIPTS } from '../lib/Constants';
import LabelingMachine from './LabelingMachine';
import { VestingContractInfo } from './ContractInfo';

export type BasicAccountInfo = {
    address: string,
    path: string,
};

export type WalletCollectionResultLedger = {
    walletInfo: WalletInfo,
    receiptsError?: Error, // if there is an incomplete result due to failed requestTxReceipts requests
    hasActivity: boolean, // whether the wallet has a transaction history or a balance or owns a contract
};
export type WalletCollectionResultKeyguard = WalletCollectionResultLedger & {
    releaseKey: (removeKey?: boolean) => Promise<KeyguardSimpleResult | void>,
};

export default class WalletInfoCollector {
    public static async collectBip39WalletInfo(
        keyId: string,
        initialAccounts: BasicAccountInfo[],
        // tslint:disable-next-line:no-empty
        onUpdate: (walletInfo: WalletInfo, currentlyCheckedAccounts: BasicAccountInfo[]) => void = () => {},
        skipActivityCheck = false,
    ): Promise<WalletCollectionResultKeyguard> {
        return WalletInfoCollector._collectLedgerOrBip39WalletInfo(WalletType.BIP39, initialAccounts, onUpdate,
            skipActivityCheck, keyId) as Promise<WalletCollectionResultKeyguard>;
    }

    public static async collectLedgerWalletInfo(
        initialAccounts: BasicAccountInfo[],
        // tslint:disable-next-line:no-empty
        onUpdate: (walletInfo: WalletInfo, currentlyCheckedAccounts: BasicAccountInfo[]) => void = () => {},
        skipActivityCheck = false,
    ): Promise<WalletCollectionResultLedger> {
        return WalletInfoCollector._collectLedgerOrBip39WalletInfo(WalletType.LEDGER, initialAccounts, onUpdate,
            skipActivityCheck);
    }

    public static async collectLegacyWalletInfo(
        keyId: string,
        singleAccount: BasicAccountInfo,
        // tslint:disable-next-line:no-empty
        onUpdate: (walletInfo: WalletInfo, currentlyCheckedAccounts: BasicAccountInfo[]) => void = () => {},
        skipActivityCheck = false,
    ): Promise<WalletCollectionResultKeyguard> {
        // Kick off loading dependencies
        WalletInfoCollector._initializeDependencies(WalletType.LEGACY);

        // Get or create the walletInfo instance
        const walletInfo = await WalletInfoCollector._getWalletInfoInstance(WalletType.LEGACY, keyId);
        const singleAccountAsArray = [singleAccount];

        WalletInfoCollector._addAccounts(walletInfo, singleAccountAsArray);
        onUpdate(walletInfo, singleAccountAsArray);

        const contracts = await WalletInfoCollector._addVestingContracts(walletInfo, singleAccount, onUpdate);
        let hasActivity = contracts.length > 0;

        if (!skipActivityCheck && !hasActivity) {
            const balances = await WalletInfoCollector._getBalances([singleAccount]);
            WalletInfoCollector._addAccounts(walletInfo, singleAccountAsArray, balances);
            onUpdate(walletInfo, []);
            hasActivity = balances.get(singleAccount.address)! > 0
                || (await WalletInfoCollector._networkInitializationPromise!
                    .then(() => NetworkClient.Instance.requestTransactionReceipts(singleAccount.address)))
                    .length > 0;
        }

        return {
            walletInfo,
            hasActivity,
            releaseKey: async (removeKey?) => {
                if (!WalletInfoCollector._keyguardClient) {
                    if (removeKey) {
                        // make sure to create a keyguardClient to be able to remove the key
                        WalletInfoCollector._initializeKeyguardClient();
                    } else {
                        // Simply return as legacy keys don't neccessarily need to be released.
                        // Only a temporary flag in the keyguard session storage is left over by not releasing.
                        return;
                    }
                }
                return WalletInfoCollector._keyguardClient!.releaseKey(keyId, removeKey);
            },
        };
    }

    private static _keyguardClient?: KeyguardClient; // TODO avoid the need to create another KeyguardClient here
    private static _networkInitializationPromise?: Promise<void>;

    private static async _collectLedgerOrBip39WalletInfo(
        walletType: WalletType,
        initialAccounts: BasicAccountInfo[] = [],
        // tslint:disable-next-line:no-empty
        onUpdate: (walletInfo: WalletInfo, currentlyCheckedAccounts: BasicAccountInfo[]) => void,
        skipActivityCheck: boolean,
        keyId?: string,
    ): Promise<WalletCollectionResultKeyguard | WalletCollectionResultLedger> {
        if (walletType !== WalletType.LEDGER && walletType !== WalletType.BIP39) {
            throw new Error('Unsupported wallet type');
        }

        // Kick off loading dependencies
        WalletInfoCollector._initializeDependencies(walletType);

        // Kick off first round of account derivation
        let startIndex = 0;
        let derivedAccountsPromise = WalletInfoCollector._deriveAccounts(startIndex,
            ACCOUNT_MAX_ALLOWED_ADDRESS_GAP, walletType, keyId);

        try {
            // For ledger retrieve the keyId from the connected Ledger.
            // Doing this after starting deriveAccounts, as the call is cheaper then.
            if (walletType === WalletType.LEDGER) {
                keyId = await LedgerApi.getWalletId();
            }

            // Get or create the walletInfo instance and derive the first set of derived accounts
            const [walletInfo, firstSetOfDerivedAccounts] = await Promise.all([
                WalletInfoCollector._getWalletInfoInstance(walletType, keyId!),
                derivedAccountsPromise,
            ]);

            // Add initial accounts to the walletInfo
            if (initialAccounts.length > 0) {
                WalletInfoCollector._addAccounts(walletInfo, initialAccounts);
            }
            onUpdate(walletInfo, firstSetOfDerivedAccounts);

            const contracts = await WalletInfoCollector._addVestingContracts(walletInfo, firstSetOfDerivedAccounts[0],
                onUpdate);
            let hasActivity = contracts.length > 0;

            // Label Keyguard BIP39 accounts according to their first identicon background color
            if (walletType === WalletType.BIP39 && walletInfo.label === ACCOUNT_TEMPORARY_LABEL_KEYGUARD) {
                walletInfo.label = LabelingMachine.labelAccount(firstSetOfDerivedAccounts[0].address);
            }

            let foundAccounts: BasicAccountInfo[];
            let receiptsError;
            do {
                const derivedAccounts = await derivedAccountsPromise;

                // already start deriving next accounts
                // By always advancing in groups of MAX_ALLOWED_GAP addresses per round, it often happens that more
                // addresses are derived and checked for activity than the BIP44 address gap limit
                // (https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki#address-gap-limit) stipulates,
                // because whenever an active address in a group of addresses is found, the next full group is also
                // derived. Thus the actual gap limit of this implementation is up to (2 x MAX_ALLOWED_GAP) - 1.
                // We argue that this is good UX for users, as potentially more of their active addresses are found,
                // even if they haven't strictly followed to the standard - at only a relatively small cost to the
                // network. For example, if the user adds the accounts derived with indices 0, 19, 39 to his wallet but
                // then only ends up using accounts 0 and 39, the account at index 19 will not be found anymore on
                // reimport. With the current implementation however, at least the account 39 would be found, while an
                // implementation strictly following the specification would stop the search at index 20.
                startIndex += ACCOUNT_MAX_ALLOWED_ADDRESS_GAP;
                derivedAccountsPromise = WalletInfoCollector._deriveAccounts(startIndex,
                    ACCOUNT_MAX_ALLOWED_ADDRESS_GAP, walletType, keyId);

                // Already add addresses that are in the initialAccounts
                foundAccounts = derivedAccounts.filter((derived) =>
                    initialAccounts.some((initial) => initial.address === derived.address));
                let accountsToCheck = skipActivityCheck || hasActivity
                    ? derivedAccounts.filter((derived) =>
                        !initialAccounts.some((initial) => initial.address === derived.address))
                    : derivedAccounts;

                const balances = await WalletInfoCollector._getBalances(accountsToCheck);
                for (const account of accountsToCheck) {
                    const balance = balances.get(account.address);
                    if (balance !== undefined && balance !== 0) {
                        foundAccounts.push(account);
                        hasActivity = true;
                    }
                }

                // for accounts with balance 0 check if there are transactions
                accountsToCheck = skipActivityCheck || hasActivity
                    ? accountsToCheck.filter((account) =>
                        !foundAccounts.some((foundAccount) => foundAccount.address === account.address))
                    : accountsToCheck; // did not find any activity, have to check all accounts
                await Promise.all(
                    accountsToCheck.map(async (account) => {
                        try {
                            await WalletInfoCollector._networkInitializationPromise;
                            const receipts = await NetworkClient.Instance.requestTransactionReceipts(account.address);
                            if (receipts.length > 0) {
                                foundAccounts.push(account);
                                hasActivity = true;
                            }
                        } catch (error) {
                            if (!error.message.startsWith(ERROR_TRANSACTION_RECEIPTS)) {
                                throw error;
                            }
                            receiptsError = error;
                            console.debug(error);
                        }
                    }),
                );

                if (foundAccounts.length > 0) {
                    WalletInfoCollector._addAccounts(walletInfo, foundAccounts, balances);
                    onUpdate(walletInfo, await derivedAccountsPromise);
                }
            } while (foundAccounts.length > 0);

            const releaseKey = walletType === WalletType.BIP39
                ? (removeKey?: boolean) => WalletInfoCollector._keyguardClient!.releaseKey(keyId!, removeKey)
                : undefined;

            return {
                walletInfo,
                receiptsError,
                releaseKey,
                hasActivity,
            };
        } finally {
            // cancel derivation of accounts that we don't need anymore if we're finished or an exception occurred
            if (walletType === WalletType.LEDGER && LedgerApi.currentRequest
                && LedgerApi.currentRequest.type === LedgerApi.RequestType.DERIVE_ACCOUNTS) {
                derivedAccountsPromise.catch(() => undefined); // to avoid uncaught promise rejection on cancel
                LedgerApi.currentRequest.cancel();
            }
        }
    }

    private static _initializeDependencies(walletType: WalletType): void {
        WalletInfoCollector._networkInitializationPromise = WalletInfoCollector._networkInitializationPromise
            || (NetworkClient.hasInstance()
                    ? NetworkClient.Instance.init() // initialize in case it's not initialized yet
                    : NetworkClient.createInstance(Config.networkEndpoint).init()
            );
        WalletInfoCollector._networkInitializationPromise
            .catch(() => delete WalletInfoCollector._networkInitializationPromise);
        if (walletType === WalletType.BIP39) this._initializeKeyguardClient();
    }

    private static _initializeKeyguardClient() {
        WalletInfoCollector._keyguardClient = WalletInfoCollector._keyguardClient
            || new KeyguardClient(Config.keyguardEndpoint);
    }

    private static async _getWalletInfoInstance(walletType: WalletType, keyId: string): Promise<WalletInfo> {
        const walletId = await WalletStore.Instance.deriveId(keyId);

        const existingWalletInfo = await WalletStore.Instance.get(walletId);
        if (existingWalletInfo) {
            existingWalletInfo.keyMissing = false;
            return existingWalletInfo;
        }

        const label = walletType === WalletType.LEGACY
            ? ACCOUNT_DEFAULT_LABEL_LEGACY
            : walletType === WalletType.BIP39
                ? ACCOUNT_TEMPORARY_LABEL_KEYGUARD
                : ACCOUNT_DEFAULT_LABEL_LEDGER;
        return new WalletInfo(
            walletId,
            keyId,
            label,
            new Map<string, AccountInfo>(),
            [],
            walletType,
            false,
        );
    }

    private static async _deriveAccounts(startIndex: number, count: number, walletType: WalletType, keyId?: string)
        : Promise<BasicAccountInfo[]> {
        switch (walletType) {
            case WalletType.LEGACY:
                throw new Error('Legacy Wallets can not derive accounts.');
            case WalletType.BIP39:
                if (!keyId) throw new Error('keyId required for Keyguard account derivation.');
                return WalletInfoCollector._deriveKeyguardAccounts(startIndex, count, keyId);
            case WalletType.LEDGER:
                return WalletInfoCollector._deriveLedgerAccounts(startIndex, count);
            default:
                throw new Error('Unsupported walletType.');
        }
    }

    private static async _deriveKeyguardAccounts(startIndex: number, count: number, keyId: string)
        : Promise<BasicAccountInfo[]> {
        const pathsToDerive = [];
        for (let index = startIndex; index < startIndex + count; ++index) {
            pathsToDerive.push(`${ACCOUNT_BIP32_BASE_PATH_KEYGUARD}${index}'`);
        }
        const derivedAddresses = await WalletInfoCollector._keyguardClient!.deriveAddresses(keyId, pathsToDerive);
        const userFriendlyAddresses = derivedAddresses.map((derivedAddress) =>
            new Nimiq.Address(derivedAddress.address).toUserFriendlyAddress());
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
        for (let index = startIndex; index < startIndex + count; ++index) {
            pathsToDerive.push(LedgerApi.getBip32PathForKeyId(index));
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
                LabelingMachine.labelAddress(newAccount.address),
                Nimiq.Address.fromUserFriendlyAddress(newAccount.address),
            );
            if (balance !== undefined) accountInfo.balance = balance;
            walletInfo.accounts.set(newAccount.address, accountInfo);
        }
    }

    private static async _addVestingContracts(
        walletInfo: WalletInfo,
        potentialOwner: BasicAccountInfo,
        onUpdate: (walletInfo: WalletInfo, currentlyCheckedAccounts: BasicAccountInfo[]) => void,
    ): Promise<VestingContractInfo[]> {
        if (walletInfo.type !== WalletType.LEGACY && walletInfo.type !== WalletType.LEDGER) {
            // Only legacy or a first Ledger addresses can be owners of genesis vesting contracts
            return [];
        }

        await WalletInfoCollector._networkInitializationPromise;
        const genesisVestingContracts = (await NetworkClient.Instance.getGenesisVestingContracts())
            .map((contract) => new VestingContractInfo(
                CONTRACT_DEFAULT_LABEL_VESTING,
                Nimiq.Address.fromUserFriendlyAddress(contract.address),
                Nimiq.Address.fromUserFriendlyAddress(contract.owner),
                contract.start,
                Nimiq.Policy.coinsToSatoshis(contract.stepAmount),
                contract.stepBlocks,
                Nimiq.Policy.coinsToSatoshis(contract.totalAmount),
            ));

        const potentialVestingOwnerAddress = Nimiq.Address.fromUserFriendlyAddress(potentialOwner.address);
        const contracts = genesisVestingContracts
            .filter((contract) => contract.owner.equals(potentialVestingOwnerAddress));

        for (const newContract of contracts) {
            const existingContract = walletInfo.findContractByAddress(newContract.address);
            if (!existingContract) {
                walletInfo.contracts.push(newContract);
            }
        }

        if (contracts.length > 0) {
            // make sure the vesting owner is added to the account too
            WalletInfoCollector._addAccounts(walletInfo, [potentialOwner]);
            onUpdate(walletInfo, []);
        }

        return contracts;
    }
}
