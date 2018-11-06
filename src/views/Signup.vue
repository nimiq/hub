<template>
        <div class="container">
        <small-page>
            <router-view/>
        </small-page>
        <a class="global-close" :class="{hidden: $route.name === `signup-success`}" @click="close">Back to {{request.appName}}</a>
    </div>
</template>

<script lang="ts">
import {Component, Emit, Vue} from 'vue-property-decorator';
import {SmallPage} from '@nimiq/vue-components';
import {ParsedSignupRequest} from '../lib/RequestTypes';
import {State} from 'vuex-class';
import {CreateResult as KCreateResult} from '@nimiq/keyguard-client';
import {ResponseStatus, State as RpcState} from '@nimiq/rpc';
import {Static} from '../lib/StaticStore';

@Component({components: {SmallPage}})
export default class Signup extends Vue {
    @Static private rpcState!: RpcState;
    @Static private request!: ParsedSignupRequest;
    @State private keyguardResult!: KCreateResult | Error | null;
    @State private activeAccountPath!: string;

    @Emit()
    private close() {
        this.rpcState.reply(ResponseStatus.ERROR, new Error('CANCEL'));
    }
}
</script>
