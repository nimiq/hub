import Vue from 'vue';
import Vuex, { StoreOptions } from 'vuex';
import {ParsedRpcRequest} from "@/lib/Requests";
import {KeyInfo} from "@/lib/KeyInfo";
import {State} from "@nimiq/rpc";
import {KeyStore} from "@/lib/KeyStore";

Vue.use(Vuex);

export interface RootState {
    request?: ParsedRpcRequest;
    rpcState?: State;
    keys: KeyInfo[];
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
        addKey(store, key) {
            store.keys.push(key);
        }
    },
    actions: {
        initKeys({ commit }) {
            // Fetch data from store
            KeyStore.Instance.list().then(keys => {
                commit('initKeys', keys);
            });
        }
    },
};

export default new Vuex.Store<RootState>(store);
