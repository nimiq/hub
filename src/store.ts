import Vue from 'vue';
import Vuex, { StoreOptions } from 'vuex';
import { RpcResult as KeyguardResult } from '@nimiq/keyguard-client';
import { WalletInfo } from '@/lib/WalletInfo';
import { WalletStore } from '@/lib/WalletStore';
import { AccountInfo } from '@/lib/AccountInfo';

Vue.use(Vuex);

export interface RootState {
    hasRpcState: boolean;
    hasRequest: boolean;
    wallets: WalletInfo[]; // TODO: this is not JSON compatible, is this a problem?
    keyguardResult: KeyguardResult | Error | null;
    chosenLoginLabel: string | null;
    activeLoginId: string | null;
    activeUserFriendlyAddress: string | null;
}

const store: StoreOptions<RootState> = {
    state: {
        hasRpcState: false,
        hasRequest: false,
        wallets: [],
        keyguardResult: null, // undefined is not reactive
        chosenLoginLabel: null,
        activeLoginId: null,
        activeUserFriendlyAddress: null,
    },
    mutations: {
        setIncomingRequest(state, payload: { hasRpcState: boolean, hasRequest: boolean }) {
            state.hasRpcState = payload.hasRpcState;
            state.hasRequest = payload.hasRequest;
        },
        initWallets(state, wallets: WalletInfo[]) {
            state.wallets = wallets;
        },
        addWallet(state, walletInfo: WalletInfo) {
            state.wallets.push(walletInfo);
        },
        setKeyguardResult(state, payload: KeyguardResult | Error) {
            state.keyguardResult = payload;
        },
        setActiveAccount(state, payload: { loginId: string, userFriendlyAddress: string }) {
            state.activeLoginId = payload.loginId;
            state.activeUserFriendlyAddress = payload.userFriendlyAddress;
            // Store as recent account for next requests
            localStorage.setItem('_recentAccount', JSON.stringify(payload));
        },
        setLoginLabel(state, label: string) {
            state.chosenLoginLabel = label;
        },
    },
    actions: {
        initWallets({ state, commit }) {
            // Fetch data from store
            WalletStore.Instance.list().then((walletInfoEntries) => {
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
                        activeWallet = state.wallets.find((x) => x.id === recentAccount.loginId);
                        activeUserFriendlyAddress = recentAccount.userFriendlyAddress;
                    } catch (err) {
                        // Do nothing
                    }
                }

                if (!activeWallet) {
                    // If none found, pre-select the first available
                    activeWallet = state.wallets[0];
                }

                if (!activeUserFriendlyAddress) {
                    // If none found, pre-select the first available
                    const account = activeWallet.accounts.values().next().value;
                    if (!account) return; // No addresses on this wallet
                    activeUserFriendlyAddress = account.userFriendlyAddress;
                }

                commit('setActiveAccount', {
                    loginId: activeWallet.id,
                    userFriendlyAddress: activeUserFriendlyAddress,
                });
            });

        },
    },
    getters: {
        findWallet: (state) => (id: string): WalletInfo | undefined => {
            return state.wallets.find((wallet) => wallet.id === id);
        },
        activeWallet: (state, getters): WalletInfo | undefined => {
            if (!state.activeLoginId) return undefined;
            return getters.findWallet(state.activeLoginId);
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
    },
};

export default new Vuex.Store<RootState>(store);
