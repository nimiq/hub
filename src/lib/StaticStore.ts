import Vue from 'vue';
import { createDecorator } from 'vue-class-component';
import { ParsedRpcRequest } from '@/lib/RequestTypes';
import { State as RpcState } from '@nimiq/rpc';

export class StaticStore {
    private static instance: StaticStore;

    public static get Instance() {
        if (!this.instance) this.instance = new StaticStore();
        return this.instance;
    }

    // To assist TypeScript, we define possible properties here
    public request?: ParsedRpcRequest;
    public rpcState?: RpcState;
    public keyguardRequest?: any;
}

// Decorator is capitalized to be consistent with vuex decorators
// tslint:disable-next-line variable-name
export const Static = <V extends Vue>  (target: V, keyName: string) => {
    return createDecorator((componentOptions, key: string) => {
        if (!componentOptions.computed) {
            componentOptions.computed = {};
        }

        componentOptions.computed[key] = () => {
            // @ts-ignore
            return StaticStore.Instance[key];
        };
    })(target, keyName);
};

export default StaticStore.Instance;
