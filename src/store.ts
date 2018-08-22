import Vue from 'vue';
import Vuex, { StoreOptions } from 'vuex';
import {ParsedRpcRequest} from '@/lib/RequestTypes';
import {KeyInfo} from '@/lib/KeyInfo';
import {State as RpcState} from '@nimiq/rpc';
import {KeyStore} from '@/lib/KeyStore';
import {RpcResult as KeyguardResult} from '@nimiq/keyguard-client';

Vue.use(Vuex);

export interface RootState {
    request?: ParsedRpcRequest;
    rpcState: RpcState | null;
    keys: KeyInfo[]; // TODO: this is not JSON compatible, is this a problem?
    keyguardResult: KeyguardResult | Error | null;
}

const store: StoreOptions<RootState> = {
    state: {
        rpcState: null, // undefined is not reactive
        keys: [],
        keyguardResult: null, // undefined is not reactive
    },
    mutations: {
        setIncomingRequest(state, payload) {
            state.rpcState = payload.rpcState;
            state.request = payload.request;
        },
        initKeys(state, keys) {
            state.keys = keys;
        },
        addKey(state, key: KeyInfo) {
            state.keys.push(key);
        },
        setKeyguardResult(state, payload) {
            state.keyguardResult = payload;
        },
    },
    actions: {
        initKeys({ commit }) {
            // Fetch data from store
            KeyStore.Instance.list().then((keys: KeyInfo[]) => {
                commit('initKeys', keys);
            });
        },
    },
};

export default new Vuex.Store<RootState>(store);
