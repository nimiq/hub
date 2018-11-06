<template>
    <div class="container">
        <small-page v-if="$route.name === `login-success`">
            <router-view/>
        </small-page>
        <!-- <a class="global-close" :class="{hidden: $route.name === `login-success`}" @click="close">Back to {{ request.appName }}</a> -->
    </div>
</template>

<script lang="ts">
import { Component, Emit, Watch, Vue } from 'vue-property-decorator';
import { SmallPage } from '@nimiq/vue-components';
import { ParsedLoginRequest } from '../lib/RequestTypes';
import { State } from 'vuex-class';
import RpcApi from '../lib/RpcApi';
import { ImportRequest, ImportResult } from '@nimiq/keyguard-client';
import { State as RpcState, ResponseStatus } from '@nimiq/rpc';
import staticStore, { Static } from '../lib/StaticStore';

@Component({components: {SmallPage}})
export default class Login extends Vue {
    @Static private rpcState!: RpcState;
    @Static private request!: ParsedLoginRequest;
    @State private keyguardResult!: ImportResult | Error | null;
    @State private activeAccountPath!: string;

    public created() {
        if (this.keyguardResult instanceof Error) {
            this.rpcState.reply(ResponseStatus.ERROR, this.keyguardResult);
        } else if (this.keyguardResult) return; // Keyguard success is handled in LoginSuccess.vue

        const request: ImportRequest = {
            appName: this.request.appName,
            defaultKeyPath: `m/44'/242'/0'/0'`,
            requestedKeyPaths: [`m/44'/242'/0'/0'`],
        };

        const client = RpcApi.createKeyguardClient(this.$store, staticStore);
        client.import(request).catch(console.error); // TODO: proper error handling
    }

    // @Emit()
    // private close() {
    //    this.rpcState.reply(ResponseStatus.ERROR, new Error('CANCEL'));
    // }
}
</script>
