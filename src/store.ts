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
    keyguardRequest: any;
    keyguardResult: KeyguardResult | Error | null;
    chosenLoginLabel: string | null;
    activeLoginId: string | null;
    activeUserFriendlyAddress: string | null;
}

const store: StoreOptions<RootState> = {
    state: {
        request: null,
        rpcState: null, // undefined is not reactive
        keys: [],
        keyguardRequest: {},
        keyguardResult: null, // undefined is not reactive
        chosenLoginLabel: null,
        activeLoginId: null,
        activeUserFriendlyAddress: null,
    },
    mutations: {
        setIncomingRequest(state, payload: { rpcState: RpcState, request: ParsedRpcRequest }) {
            state.rpcState = payload.rpcState;
            state.request = payload.request;
        },
        setKeyguardRequest(state, keyguardRequest: any) {
            state.keyguardRequest = keyguardRequest;
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
        initKeys({ state, commit }) {
            // Fetch data from store
            KeyStore.Instance.list().then((keyInfoEntries) => {
                const keys = keyInfoEntries.map((keyInfoEntry) => KeyInfo.fromObject(keyInfoEntry));

                commit('initKeys', keys as KeyInfo[]);

                if (keys.length === 0) return;

                // Try loading active
                let activeKey: KeyInfo | undefined;
                let activeUserFriendlyAddress: string | null = null;

                const storedRecentAccount = localStorage.getItem('_recentAccount');
                if (storedRecentAccount) {
                    try {
                        const recentAccount = JSON.parse(storedRecentAccount);
                        activeKey = state.keys.find((x) => x.id === recentAccount.loginId);
                        activeUserFriendlyAddress = recentAccount.userFriendlyAddress;
                    } catch (err) {
                        // Do nothing
                    }
                }

                if (!activeKey) {
                    // If none found, pre-select the first available
                    activeKey = state.keys[0];
                }

                if (!activeUserFriendlyAddress) {
                    // If none found, pre-select the first available
                    const account = activeKey.addresses.values().next().value;
                    if (!account) return; // No addresses on this key
                    activeUserFriendlyAddress = account.userFriendlyAddress;
                }

                commit('setActiveAccount', {
                    loginId: activeKey.id,
                    userFriendlyAddress: activeUserFriendlyAddress,
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
            if (!state.activeUserFriendlyAddress) return undefined;
            const key: KeyInfo | undefined = getters.activeKey;
            if (!key) return undefined;
            return key.addresses.get(state.activeUserFriendlyAddress);
        },
        hasWallets: (state): boolean => {
            return state.keys.length > 0;
        },
    },
};

export default new Vuex.Store<RootState>(store);
