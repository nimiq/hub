<template>
    <div class="container">
        <small-page>
            <Success
                v-bind:requestName="requestName"
                v-bind:appName="this.request.appName"
                v-bind:close="this.done"
                />
        </small-page>
    </div>
</template>

<script lang="ts">
import { Component, Emit, Vue } from 'vue-property-decorator';
import { SmallPage } from '@nimiq/vue-components';
import { Route } from 'vue-router';
import { State } from 'vuex-class';
import { ResponseStatus, State as RpcState } from '@nimiq/rpc';
import { RpcRequest } from '../lib/RequestTypes';
import { RpcResult } from '@nimiq/keyguard-client';
import staticStore, { Static } from '@/lib/StaticStore';
import Success from '../components/Success.vue';

@Component({components: {SmallPage, Success}})
export default class SimpleSuccess extends Vue {

    @Static private request!: RpcRequest;
    @Static private rpcState!: RpcState;
    @State private keyguardResult!: RpcResult;

    get requestName() {
        switch (this.$route.name) {
            case 'export-file-success':
                return 'Wallet File export';
            case 'export-words-success':
                return 'Recovery Words export';
            case 'change-passphrase-success':
                return 'passphrase change'
            default:
                return '';
        }
    }

    public async created() {
        // TODO maybe don't just return to caller, but instead show some error page?
        if (this.keyguardResult instanceof Error) {
            this.rpcState.reply(ResponseStatus.ERROR, this.keyguardResult);
        }
    }

    @Emit()
    private done() {
        this.rpcState.reply(ResponseStatus.OK, this.keyguardResult);
    }
}
</script>
