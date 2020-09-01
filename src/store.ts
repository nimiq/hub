import Vue from 'vue';
import Vuex, { StoreOptions } from 'vuex';
import { Result as KeyguardResult } from '@nimiq/keyguard-client';
import { WalletInfo, WalletType } from '@/lib/WalletInfo';
import { WalletStore } from '@/lib/WalletStore';
import { AccountInfo } from '@/lib/AccountInfo';
import { labelLegacyAccountGroup } from '@/lib/LabelingMachine';
import { LEGACY_GROUPING_ACCOUNT_ID } from '@/lib/Constants';
import { ContractInfo } from './lib/ContractInfo';

Vue.use(Vuex);

export interface RootState {
    isRequestLoaded: boolean;
    wallets: WalletInfo[]; // TODO: this is not JSON compatible, is this a problem?
    keyguardResult: KeyguardResult | Error | null;
    chosenWalletLabel: string | null;
    activeWalletId: string | null;
    activeUserFriendlyAddress: string | null;
}

const store: StoreOptions<RootState> = {
    state: {
        isRequestLoaded: false,
        wallets: [],
        keyguardResult: null, // undefined is not reactive
        chosenWalletLabel: null,
        activeWalletId: null,
        activeUserFriendlyAddress: null,
    },
    mutations: {
        setRequestLoaded(state, payload: boolean) {
            state.isRequestLoaded = payload;
        },
        initWallets(state, wallets: WalletInfo[]) {
            state.wallets = wallets;
        },
        addWallet(state, walletInfo: WalletInfo) {
            const existingWallet = state.wallets.find((wallet) => wallet.id === walletInfo.id);
            if (!existingWallet) {
                state.wallets.push(walletInfo);
                return;
            }

            const index = state.wallets.indexOf(existingWallet);
            state.wallets.splice(index, 1, walletInfo);
        },
        setKeyguardResult(state, payload: KeyguardResult | Error) {
            state.keyguardResult = payload;
        },
        setActiveAccount(state, payload: { walletId: string, userFriendlyAddress: string }) {
            state.activeWalletId = payload.walletId;
            state.activeUserFriendlyAddress = payload.userFriendlyAddress;
            // Store as recent account for next requests
            localStorage.setItem('_recentAccount', JSON.stringify(payload));
        },
        setWalletLabel(state, label: string) {
            state.chosenWalletLabel = label;
        },
    },
    actions: {
        initWallets({ state, commit }) {
            // Fetch data from store
            return WalletStore.Instance.list().then((walletInfoEntries) => {
                const wallets = walletInfoEntries.map((walletInfoEntry) => WalletInfo.fromObject(walletInfoEntry));
                commit('initWallets', wallets);

                if (wallets.length === 0) return;

                // Try loading active
                let activeWallet: WalletInfo | undefined;
                let activeUserFriendlyAddress: string | null = null;

                const storedRecentAccount = localStorage.getItem('_recentAccount');
                if (storedRecentAccount) {
                    try {
                        const recentAccount = JSON.parse(storedRecentAccount);
                        activeWallet = state.wallets.find((x) => x.id === recentAccount.walletId);
                        activeUserFriendlyAddress = recentAccount.userFriendlyAddress;
                    } catch (err) {
                        // Do nothing
                    }
                }

                if (!activeWallet) {
                    // If none found, pre-select the first available
                    activeWallet = state.wallets[0];
                }

                // Validate that the address exists on the active wallet
                if (activeUserFriendlyAddress) {
                    const activeAccount = activeWallet.accounts.get(activeUserFriendlyAddress);
                    if (!activeAccount) activeUserFriendlyAddress = null;
                }

                if (!activeUserFriendlyAddress) {
                    // If none found, pre-select the first available
                    const account = activeWallet.accounts.values().next().value;
                    if (!account) return; // No addresses on this wallet
                    activeUserFriendlyAddress = account.userFriendlyAddress;
                }

                commit('setActiveAccount', {
                    walletId: activeWallet.id,
                    userFriendlyAddress: activeUserFriendlyAddress,
                });
            });
        },
        addWalletAndSetActive({ commit }, walletInfo: WalletInfo) {
            commit('addWallet', walletInfo);
            commit('setActiveAccount', {
                walletId: walletInfo.id,
                userFriendlyAddress: walletInfo.accounts.values().next().value.userFriendlyAddress,
            });
        },
    },
    getters: {
        findWallet: (state) => (id: string): WalletInfo | undefined => {
            return state.wallets.find((wallet) => wallet.id === id);
        },
        findWalletByAddress: (state) => (address: string, includeContracts: boolean): WalletInfo | undefined => {
            const foundWallet = state.wallets.find((wallet) => wallet.accounts.has(address));
            if (foundWallet || !includeContracts) return foundWallet;
            return state.wallets.find((wallet) => wallet.contracts.some((contract) => {
                return contract.address.toUserFriendlyAddress() === address;
            }));
        },
        findWalletByKeyId: (state) => (keyId: string): WalletInfo | undefined => {
            return state.wallets.find((wallet) => wallet.keyId === keyId);
        },
        activeWallet: (state, getters): WalletInfo | undefined => {
            if (!state.activeWalletId) return undefined;
            return getters.findWallet(state.activeWalletId);
        },
        activeAccount: (state, getters): AccountInfo | undefined => {
            if (!state.activeUserFriendlyAddress) return undefined;
            const wallet: WalletInfo | undefined = getters.activeWallet;
            if (!wallet) return undefined;
            return wallet.accounts.get(state.activeUserFriendlyAddress);
        },
        hasWallets: (state): boolean => {
            return state.wallets.length > 0;
        },
        processedWallets: (state) => {
            const singleAccounts = new Map<string, AccountInfo>();
            const singleContracts: ContractInfo[] = [];

            const processedWallets = state.wallets.filter((wallet) => {
                if (wallet.keyMissing) return false;
                if (wallet.type !== WalletType.LEGACY) return true;

                const [singleAccountAddress, singleAccountInfo] = Array.from(wallet.accounts.entries())[0];
                singleAccountInfo.walletId = wallet.id;
                singleAccounts.set(singleAccountAddress, singleAccountInfo);

                for (const contract of wallet.contracts) {
                    contract.walletId = wallet.id;
                    singleContracts.push(contract);
                }

                return false;
            });

            if (singleAccounts.size > 0) {
                processedWallets.push(new WalletInfo(
                    LEGACY_GROUPING_ACCOUNT_ID,
                    /* keyId */ '',
                    labelLegacyAccountGroup(),
                    singleAccounts,
                    singleContracts,
                    WalletType.LEGACY,
                ));
            }

            return processedWallets;
        },
        addressCount: (state) => {
            return state.wallets.reduce((count, wallet) => count + wallet.accounts.size + wallet.contracts.length, 0);
        },
    },
};

export default new Vuex.Store<RootState>(store);
