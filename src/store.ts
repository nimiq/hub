import Vue from 'vue';
import Vuex, { StoreOptions } from 'vuex';
import {ParsedRpcRequest} from "@/lib/Requests";
import {KeyInfo} from "@/lib/KeyInfo";
import {State} from "@nimiq/rpc";

Vue.use(Vuex);

interface RootState {
    request?: ParsedRpcRequest;
    rpcState?: State;
    keys?: KeyInfo[];
}

const store: StoreOptions<RootState> = {
    state: {
    },
    mutations: {
    },
    actions: {
    },
};

export default new Vuex.Store<RootState>(store);
