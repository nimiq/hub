import Vue from 'vue';
import Vuex, { StoreOptions } from 'vuex';
import {ParsedRpcRequest} from '@/lib/RequestTypes';
import {KeyInfo} from '@/lib/KeyInfo';
import {State} from '@nimiq/rpc';
import {KeyStore} from '@/lib/KeyStore';
import {RpcResult as KeyguardResult} from '@/lib/keyguard/RequestTypes';

Vue.use(Vuex);

export interface RootState {
    request?: ParsedRpcRequest;
    rpcState?: State;
    keys: KeyInfo[]; // TODO: this is not JSON compatible, is this a problem?
    keyguardResult?: KeyguardResult | Error;
}

const store: StoreOptions<RootState> = {
    state: {
        keys: [],
    },
    mutations: {
        setIncomingRequest(store, payload) {
            store.request = payload.request;
            store.rpcState = payload.rpcState;
        },
        initKeys(store, keys) {
            store.keys = keys;
        },
        addKey(store, key: KeyInfo) {
            store.keys.push(key);
        },
        setKeyguardResult(store, payload) {
            store.keyguardResult = payload;
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
