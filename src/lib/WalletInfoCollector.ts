import { NetworkClient } from '@nimiq/network-client';
import { KeyguardClient } from '@nimiq/keyguard-client';
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
import { ContractInfo, VestingContractInfo } from './ContractInfo';

type BasicAccountInfo = {
    address: string,
    path: string,
};

export type WalletCollectionResult = {
    walletInfo: WalletInfo,
    receiptsError?: Error, // if there is an incomplete result due to failed requestTxReceipts requests
    releaseKey: (removeKey: boolean) => void,
    hasHistoryOrBalance: boolean, // if the wallet has a transaction history or a balance
};

export default class WalletInfoCollector {
    public static async collectWalletInfo(
        walletType: WalletType,
        keyId: string,
        initialAccounts: BasicAccountInfo[] = [],
        // tslint:disable-next-line:no-empty
        onUpdate: (walletInfo: WalletInfo, currentlyCheckedAccounts: BasicAccountInfo[]) => void = () => {},
        checkLegacyActivity = true,
    ): Promise<WalletCollectionResult> {
        // Kick off loading dependencies
        WalletInfoCollector._initializeDependencies(walletType);

        // track activity of the wallet
        let hasHistoryOrBalance = false;
        // Kick off first round of account derivation
        let startIndex = 0;
        let derivedAccountsPromise: Promise<BasicAccountInfo[]>;
        if (walletType === WalletType.LEGACY) {
            derivedAccountsPromise = Promise.resolve([]);
        } else {
            derivedAccountsPromise = WalletInfoCollector._deriveAccounts(startIndex,
                ACCOUNT_MAX_ALLOWED_ADDRESS_GAP, walletType, keyId);
        }

        // Get or create the walletInfo instance
        const walletInfo = await WalletInfoCollector._getWalletInfoInstance(walletType, keyId);

        // Search for genesis vesting contracts
        // (only legacy or a first ledger addresses can be owners of genesis vesting contracts)
        if (walletType === WalletType.LEGACY || walletType === WalletType.LEDGER) {
            const potentialVestingOwner = walletType === WalletType.LEGACY
                ? initialAccounts[0] // for legacy wallets we get the only account as initialAccounts from the Keyguard
                : (await derivedAccountsPromise)[0]; // for ledger we check the first derived account
            const contracts = await WalletInfoCollector._getGenesisVestingContractsForAddress(
                Nimiq.Address.fromUserFriendlyAddress(potentialVestingOwner.address));
            WalletInfoCollector._addContracts(walletInfo, contracts);
            if (contracts.length > 0
                && !initialAccounts.some((account) => account.address === potentialVestingOwner.address)) {
                // make sure a ledger vesting owner account get's added even if it has no balance or transaction history
                initialAccounts.push(potentialVestingOwner);
                hasHistoryOrBalance = true;
            }
        }

        // Add initial accounts to the walletInfo
        let initialAccountsPromise = Promise.resolve();
        if (initialAccounts.length > 0) {
            WalletInfoCollector._addAccounts(walletInfo, initialAccounts, undefined);

            // fetch balances and update again
            // for legacy accounts only fetch balance if the corresponding flag is set
            if (walletType !== WalletType.LEGACY || checkLegacyActivity) {
                initialAccountsPromise = WalletInfoCollector._getBalances(initialAccounts).then(async (balances) => {
                    WalletInfoCollector._addAccounts(walletInfo, initialAccounts, balances);
                    onUpdate(walletInfo, await derivedAccountsPromise);
                });
            }
        }
        onUpdate(walletInfo, await derivedAccountsPromise);

        if (walletType === WalletType.LEGACY && WalletInfoCollector._keyguardClient) {
            // legacy wallets have no derived accounts
            await initialAccountsPromise;
            const address = initialAccounts[0].address;

            if (checkLegacyActivity) {
                hasHistoryOrBalance = walletInfo.accounts.get(address)!.balance !== undefined &&
                    walletInfo.accounts.get(address)!.balance !== 0 ||
                    (await NetworkClient.Instance.requestTransactionReceipts(address)).length > 0;
            }

            return {
                walletInfo,
                releaseKey: (removeKey) => {
                    WalletInfoCollector._keyguardClient!.releaseKey(keyId, removeKey);
                },
                hasHistoryOrBalance,
            };
        }

        // Label Keyguard accounts according to their first identicon background color
        if (walletType === WalletType.BIP39 && walletInfo.label === ACCOUNT_TEMPORARY_LABEL_KEYGUARD) {
            walletInfo.label = LabelingMachine.labelAccount((await derivedAccountsPromise)[0].address);
        }

        let foundAccounts: BasicAccountInfo[];
        let receiptsError;
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
            startIndex += ACCOUNT_MAX_ALLOWED_ADDRESS_GAP;
            derivedAccountsPromise = WalletInfoCollector._deriveAccounts(startIndex,
                ACCOUNT_MAX_ALLOWED_ADDRESS_GAP, walletType, keyId);

            // find accounts with a balance > 0
            const foundAddresses: string[] = [];
            const balances = await WalletInfoCollector._getBalances(derivedAccounts!);
            for (const account of derivedAccounts!) {
                const balance = balances.get(account.address);
                if (balance !== undefined && balance !== 0) {
                    foundAddresses.push(account.address);
                    hasHistoryOrBalance = true;
                }
            }

            // for accounts with balance 0 check if there are transactions
            const addressesToCheck = derivedAccounts.map((account) => account.address)
                .filter((address) => foundAddresses.indexOf(address) === -1);
            await Promise.all(
                addressesToCheck.map(async (address) => {
                    try {
                        const receipts = await NetworkClient.Instance.requestTransactionReceipts(address);
                        if (receipts.length > 0) {
                            foundAddresses.push(address);
                            hasHistoryOrBalance = true;
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

            foundAccounts = derivedAccounts.filter((account) => foundAddresses.indexOf(account.address) !== -1);

            if (foundAccounts.length > 0) {
                WalletInfoCollector._addAccounts(walletInfo, foundAccounts, balances);
                onUpdate(walletInfo, derivedAccounts);
            }
        } while (foundAccounts.length > 0);

        // clean up
        if (walletType === WalletType.LEDGER && LedgerApi.currentRequest
            && LedgerApi.currentRequest.type === LedgerApi.RequestType.DERIVE_ACCOUNTS) {
            // next round of derivation still going on although we don't need it
            derivedAccountsPromise.catch(() => undefined); // to avoid uncaught promise rejection for cancel
            derivedAccountsPromise = Promise.resolve([]); // for if the initial balance onUpdate did not fire yet
            LedgerApi.currentRequest.cancel();
        }

        await initialAccountsPromise; // make sure initial accounts balances are updated
        return {
            walletInfo,
            receiptsError,
            releaseKey: (removeKey) => {
                WalletInfoCollector._keyguardClient!.releaseKey(keyId, removeKey);
            },
            hasHistoryOrBalance,
        };
    }

    private static _keyguardClient?: KeyguardClient; // TODO avoid the need to create another KeyguardClient here
    private static _networkInitializationPromise?: Promise<void>;
    private static _wasmInitializationPromise?: Promise<void>;

    private static _initializeDependencies(walletType: WalletType): void {
        WalletInfoCollector._networkInitializationPromise =
            WalletInfoCollector._networkInitializationPromise
            || NetworkClient.createInstance(Config.networkEndpoint).init();
        WalletInfoCollector._networkInitializationPromise
            .catch(() => delete WalletInfoCollector._networkInitializationPromise);
        if (walletType === WalletType.BIP39 || walletType === WalletType.LEGACY) {
            WalletInfoCollector._keyguardClient = WalletInfoCollector._keyguardClient
                || new KeyguardClient(Config.keyguardEndpoint);
        } else if (walletType === WalletType.LEDGER) {
            WalletInfoCollector._wasmInitializationPromise =
                WalletInfoCollector._wasmInitializationPromise || Nimiq.WasmHelper.doImportBrowser();
            WalletInfoCollector._wasmInitializationPromise
                .catch(() => delete WalletInfoCollector._wasmInitializationPromise);
        }
    }

    private static async _getWalletInfoInstance(walletType: WalletType, keyId: string): Promise<WalletInfo> {
        let walletId: string;
        if (walletType === WalletType.LEDGER) {
            // for Ledger, we retrieve the walletId from the currently connected ledger
            walletId = await LedgerApi.getWalletId();
        } else {
            walletId = await WalletStore.deriveId(keyId);
        }

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
        const serializedAddresses = await WalletInfoCollector._keyguardClient!.deriveAddresses(keyId, pathsToDerive);
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

    private static _addContracts(
        walletInfo: WalletInfo,
        newContracts: ContractInfo[],
    ): void {
        for (const newContract of newContracts) {
            const existingContract = walletInfo.findContractByAddress(newContract.address);
            if (!existingContract) {
                walletInfo.contracts.push(newContract);
            }
        }
    }

    private static async _getGenesisVestingContractsForAddress(address: Nimiq.Address): Promise<VestingContractInfo[]> {
        const genesisVestingContracts = await WalletInfoCollector._getGenesisVestingContracts();
        return genesisVestingContracts.filter((contract) => contract.owner.equals(address));
    }

    private static async _getGenesisVestingContracts(): Promise<VestingContractInfo[]> {
        await WalletInfoCollector._networkInitializationPromise;
        const contracts = await NetworkClient.Instance.getGenesisVestingContracts();

        return contracts.map((contract) => new VestingContractInfo(
            CONTRACT_DEFAULT_LABEL_VESTING,
            Nimiq.Address.fromUserFriendlyAddress(contract.address),
            Nimiq.Address.fromUserFriendlyAddress(contract.owner),
            contract.start,
            Nimiq.Policy.coinsToSatoshis(contract.stepAmount),
            contract.stepBlocks,
            Nimiq.Policy.coinsToSatoshis(contract.totalAmount),
        ));
    }
}
