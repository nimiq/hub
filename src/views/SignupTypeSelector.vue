<template>
    <div>
        <PageHeader :backArrow="false">Add a Wallet</PageHeader>
        <button @click="createKeyguard">Keyguard</button>
        <button @click="createLedger">Ledger</button>
    </div>
</template>

<script lang="ts">
import {Component, Emit, Prop, Watch, Vue} from 'vue-property-decorator';
import {PageHeader} from '@nimiq/vue-components';
import {RequestType, ParsedSignupRequest} from '../lib/RequestTypes';
import {AddressInfo} from '../lib/AddressInfo';
import {KeyInfo, KeyStorageType} from '../lib/KeyInfo';
import {State, Mutation, Getter} from 'vuex-class';
import RpcApi from '../lib/RpcApi';
import {CreateRequest as KCreateRequest, CreateResult as KCreateResult} from '@nimiq/keyguard-client';
import {ResponseStatus, State as RpcState} from '@nimiq/rpc';

@Component({components: {PageHeader}})
export default class extends Vue {
    @State private request!: ParsedSignupRequest;
    @State private keyguardResult!: KCreateResult | Error | null;
    @State private activeAccountPath!: string;

    public createKeyguard() {
        const client = RpcApi.createKeyguardClient(this.$store);

        const request: KCreateRequest = {
            appName: this.request.appName,
            defaultKeyPath: `m/44'/242'/0'/0'`, // FIXME: not used yet
        };

       client.create(request).catch((error) => {
           console.log(error); // TODO: proper error handling
       });
    }

    public createLedger() {

    }
}
</script>

<style scoped>
   
</style>
