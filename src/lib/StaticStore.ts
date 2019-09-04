import Vue from 'vue';
import { createDecorator } from 'vue-class-component';
import { ParsedRpcRequest } from './RequestTypes';
import { RpcResult, RequestType } from './PublicRequestTypes';
import { State as RpcState } from '@nimiq/rpc';
import { Request as KeyguardRequest } from '@nimiq/keyguard-client';

export class StaticStore {
    private static instance: StaticStore;

    public static get Instance() {
        if (!this.instance) this.instance = new StaticStore();
        return this.instance;
    }

    // To assist TypeScript, we define possible properties here
    public request?: ParsedRpcRequest;
    public kind?: RequestType;
    public rpcState?: RpcState;
    public keyguardRequest?: KeyguardRequest;
    public originalRouteName?: string;
    public sideResult?: RpcResult | Error;
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
