import Vue from 'vue';
import Vuex, { StoreOptions } from 'vuex';
import {State as RpcState} from '@nimiq/rpc';
import {RpcResult as KeyguardResult} from '@nimiq/keyguard-client';
import {ParsedRpcRequest} from '@/lib/RequestTypes';
import {KeyInfo} from '@/lib/KeyInfo';
import {KeyStore} from '@/lib/KeyStore';
import { AddressInfo } from '@/lib/AddressInfo';

Vue.use(Vuex);

export interface RootState {
    request: ParsedRpcRequest | null;
    rpcState: RpcState | null;
    keys: KeyInfo[]; // TODO: this is not JSON compatible, is this a problem?
    keyguardResult: KeyguardResult | Error | null;
    chosenLoginLabel: string | null,
    activeLoginId: string | null;
    activeAccountPath: string | null;
}

const store: StoreOptions<RootState> = {
    state: {
        request: null,
        rpcState: null, // undefined is not reactive
        keys: [],
        keyguardResult: null, // undefined is not reactive
        chosenLoginLabel: null,
        activeLoginId: null,
        activeAccountPath: null,
    },
    mutations: {
        setIncomingRequest(state, payload: { rpcState: RpcState, request: ParsedRpcRequest }) {
            state.rpcState = payload.rpcState;
            state.request = payload.request;
        },
        initKeys(state, keys: KeyInfo[]) {
            state.keys = keys;
        },
        addKey(state, key: KeyInfo) {
            state.keys.push(key);
        },
        setKeyguardResult(state, payload: KeyguardResult | Error) {
            state.keyguardResult = payload;
        },
        setActiveAccount(state, payload: { loginId: string, accountPath: string }) {
            state.activeLoginId = payload.loginId;
            state.activeAccountPath = payload.accountPath;
            // Store as recent account for next requests
            localStorage.setItem('_recentAccount', JSON.stringify(payload));
        },
        setLoginLabel(state, label: string) {
            state.chosenLoginLabel = label;
        },
    },
    actions: {
        initKeys({ state, commit }) {
            // Fetch data from store
            KeyStore.Instance.list().then((keys) => {
                commit('initKeys', keys);

                if (keys.length === 0) return;

                // Try loading active
                let activeAccount: KeyInfo | undefined;
                let activeAccountPath: string | null = null;

                const storedRecentAccount = localStorage.getItem('_recentAccount');
                if (storedRecentAccount) {
                    try {
                        const activeAccountInfo = JSON.parse(storedRecentAccount);
                        activeAccount = state.keys.find((x) => x.id === activeAccountInfo.loginId);
                        activeAccountPath = activeAccountInfo.accountPath;
                    } catch (err) {
                        // Do nothing
                    }
                }

                if (!activeAccount) {
                    // If none found, pre-select the first available
                    activeAccount = state.keys[0];
                }

                if (!activeAccountPath) {
                    // If none found, pre-select the first available
                    const account = activeAccount.addresses.values().next().value;
                    if (!account) return; // No addresses on this key
                    activeAccountPath = account.path;
                }

                commit('setActiveAccount', {
                    loginId: activeAccount.id,
                    accountPath: activeAccountPath,
                });
            });

        },
    },
    getters: {
        findKey: (state) => (id: string): KeyInfo | undefined => {
            return state.keys.find((key) => key.id === id);
        },
        activeKey: (state, getters): KeyInfo | undefined => {
            if (!state.activeLoginId) return undefined;
            return getters.findKey(state.activeLoginId);
        },
        activeAccount: (state, getters): AddressInfo | undefined => {
            if (!state.activeAccountPath) return undefined;
            const key: KeyInfo | undefined = getters.activeKey;
            if (!key) return undefined;
            return key.addresses.get(state.activeAccountPath);
        },
    },
};

export default new Vuex.Store<RootState>(store);
