<template>
    <div class="container">
        <small-page>
            <Success
                :text="text"
                :appName="request.appName"
                @close="done"
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

    get text() {
        switch (this.$route.name) {
            case 'export-file-success':
                return 'Your Wallet File export was successful';
            case 'export-words-success':
                return 'Your Recovery Words export was successful';
            case 'change-passphrase-success':
                return 'You successfully changed your passphrase ';
            default:
                throw new Error('No matching route');
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
