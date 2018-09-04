<template>
    <div>
        Success!
    </div>
</template>

<script lang="ts">
import {Component, Emit, Prop, Watch, Vue} from 'vue-property-decorator';
import {AccountSelector, LoginSelector, PaymentInfoLine, SmallPage} from '@nimiq/vue-components';
import {RequestType, ParsedSignupRequest} from '../lib/RequestTypes';
import {AddressInfo} from '../lib/AddressInfo';
import {KeyInfo, KeyStorageType} from '../lib/KeyInfo';
import {State, Mutation, Getter} from 'vuex-class';
import RpcApi from '../lib/RpcApi';
import {CreateRequest as KCreateRequest, CreateResult as KCreateResult} from '@nimiq/keyguard-client';
import {ResponseStatus, State as RpcState} from '@nimiq/rpc';

@Component({components: {PaymentInfoLine, SmallPage}})
export default class extends Vue {
    @State private rpcState!: RpcState;
    @State private request!: ParsedSignupRequest;
    @State private keyguardResult!: KCreateResult | Error | null;
    @State private activeAccountPath!: string;

    public created() {
        const client = RpcApi.createKeyguardClient(this.$store);

        const request: KCreateRequest = {
            appName: this.request.appName,
            defaultKeyPath: `m/44'/242'/0'/0'`,
        };

        client.create(request).catch(console.error); // TODO: proper error handling
    }

    @Watch('keyguardResult', {immediate: true})
    private onKeyguardResult() {
        if (this.keyguardResult instanceof Error) {
            // Key/Account was not created
            console.error(this.keyguardResult);
        } else if (this.keyguardResult && this.rpcState) {
            // Success
            // Redirect to /create/set-label
            console.log(this.keyguardResult, this.rpcState);
        }
    }

    @Emit()
    private close() {
        window.close();
    }
}
</script>

<style scoped>
   
</style>
