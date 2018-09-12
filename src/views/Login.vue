<template>
    <div class="container">
        <small-page>
            <router-view/>
        </small-page>
        <a class="global-close" :class="{hidden: $route.name === `login-success`}" @click="close">Back to {{ request.appName }}</a>
    </div>
</template>

<script lang="ts">
import {Component, Emit, Watch, Vue} from 'vue-property-decorator';
import {SmallPage} from '@nimiq/vue-components';
import {ParsedLoginRequest} from '../lib/RequestTypes';
import {State} from 'vuex-class';
import RpcApi from '../lib/RpcApi';
import {ImportRequest, ImportResult} from '@nimiq/keyguard-client';
import {State as RpcState} from '@nimiq/rpc';
import staticStore, {Static} from '../lib/StaticStore';

@Component({components: {SmallPage}})
export default class Login extends Vue {
    @Static private rpcState!: RpcState;
    @Static private request!: ParsedLoginRequest;
    @State private keyguardResult!: ImportResult | Error | null;
    @State private activeAccountPath!: string;

    public created() {
        const client = RpcApi.createKeyguardClient(this.$store, staticStore);

        const request: ImportRequest = {
            appName: this.request.appName,
        };

        client.import(request).catch(console.error); // TODO: proper error handling
    }

    @Watch('keyguardResult', {immediate: true})
    private onKeyguardResult() {
        if (this.keyguardResult instanceof Error) {
            // Key/Account was not imported
            console.error(this.keyguardResult);
        } else if (this.keyguardResult && this.rpcState) {
            // Success
            // Redirect to /import/set-label
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
    .container {
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .global-close {
        display: inline-block;
        height: 27px;
        border-radius: 13.5px;
        background-color: rgba(0, 0, 0, 0.1);
        font-size: 14px;
        font-weight: 600;
        line-height: 27px;
        color: white;
        padding: 0 12px;
        cursor: pointer;
        margin-top: 64px;
        margin-bottom: 40px;
    }

    .global-close::before {
        content: '';
        display: inline-block;
        height: 11px;
        width: 11px;
        background-image: url('data:image/svg+xml,<svg height="24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M0 0h24v24H0z" fill="none"/><path fill="%23fff" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>');
        background-repeat: no-repeat;
        background-size: 16px;
        background-position: center;
        margin-right: 8px;
        margin-bottom: -1px;
    }

    .global-close.hidden {
        visibility: hidden;
        pointer-events: none;
    }
</style>
