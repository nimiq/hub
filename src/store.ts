import Vue from 'vue';
import Vuex, { StoreOptions } from 'vuex';
import {ParsedRpcRequest} from '@/lib/RequestTypes';
import {KeyInfo} from '@/lib/KeyInfo';
import {State as RpcState, State} from '@nimiq/rpc';
import {KeyStore} from '@/lib/KeyStore';
import {RpcResult as KeyguardResult} from '@/lib/keyguard/RequestTypes';
import { AddressInfo } from '@/lib/AddressInfo';

Vue.use(Vuex);

export interface RootState {
    request: ParsedRpcRequest | null;
    rpcState: RpcState | null;
    keys: KeyInfo[]; // TODO: this is not JSON compatible, is this a problem?
    keyguardResult: KeyguardResult | Error | null;
    activeLoginId: string | null;
    activeAccountPath: string | null;
}

const store: StoreOptions<RootState> = {
    state: (() => {
        // Try loading active
        let activeLoginId: null|string = null;
        let activeAccountPath: null|string = null;

        const storedRecentAccount = localStorage.getItem('_recentAccount');
        if (storedRecentAccount) {
            try {
                const activeAccount = JSON.parse(storedRecentAccount);
                activeLoginId = activeAccount.loginId;
                activeAccountPath = activeAccount.accountPath;
            } catch (err) {
                // Do nothing
            }
        }

        const state: RootState = {
            request: null,
            rpcState: null, // undefined is not reactive
            keys: [],
            keyguardResult: null, // undefined is not reactive
            activeLoginId,
            activeAccountPath,
        };

        return state;
    })(),
    mutations: {
        setIncomingRequest(state, payload: {rpcState: RpcState, request: ParsedRpcRequest}) {
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
        setActiveAccount(state, payload: {loginId: string, accountPath: string}) {
            state.activeLoginId = payload.loginId;
            state.activeAccountPath = payload.accountPath;
            // Store as recent account for next requests
            localStorage.setItem('_recentAccount', JSON.stringify(payload));
        },
    },
    actions: {
        initKeys({state, commit }) {
            // Fetch data from store
            KeyStore.Instance.list().then((keys) => {
                commit('initKeys', keys);

                if (state.activeLoginId && state.activeAccountPath) return;

                // If none found, pre-select the first available
                const key = state.keys[0];
                if (!key) return; // No keys stored
                const account = key.addresses.values().next().value;
                if (!account) return; // No addresses on this key

                commit('setActiveAccount', {
                    loginId: key.id,
                    accountPath: account.path,
                });
            });
        },
    },
    getters: {
        findKey: (state) => (id: string): KeyInfo|undefined => {
            return state.keys.find((key) => key.id === id);
        },
        activeKey: (state, getters): KeyInfo|undefined => {
            if (!state.activeLoginId) return undefined;
            return getters.findKey(state.activeLoginId);
        },
        activeAccount: (state, getters): AddressInfo|undefined => {
            if (!state.activeAccountPath) return undefined;
            const key: KeyInfo|undefined = getters.activeKey;
            if (!key) return undefined;
            return key.addresses.get(state.activeAccountPath);
        },
    },
};

export default new Vuex.Store<RootState>(store);
