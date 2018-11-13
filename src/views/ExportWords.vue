<template>
    <div class="container">
        <small-page v-if="$route.name === `export-words-success`">
            <router-view/>
        </small-page>
        <!-- <a class="global-close" :class="{hidden: $route.name === `export-words-success`}" @click="close">Back to {{ request.appName }}</a> -->
    </div>
</template>

<script lang="ts">
import { Component, Emit, Watch, Vue } from 'vue-property-decorator';
import { SmallPage } from '@nimiq/vue-components';
import { ParsedExportWordsRequest, ExportWordsResult } from '../lib/RequestTypes';
import { State } from 'vuex-class';
import RpcApi from '../lib/RpcApi';
import {
    ExportWordsRequest as KExportWordsRequest,
    ExportWordsResult as KExportWordsResult,
} from '@nimiq/keyguard-client';
import { State as RpcState, ResponseStatus } from '@nimiq/rpc';
import { WalletStore } from '@/lib/WalletStore';
import staticStore, { Static } from '../lib/StaticStore';

@Component({components: {SmallPage}})
export default class ExportWords extends Vue {
    @Static private rpcState!: RpcState;
    @Static private request!: ParsedExportWordsRequest;
    @State private keyguardResult!: KExportWordsResult | Error | null;

    public async created() {
        if (this.keyguardResult instanceof Error) {
            this.rpcState.reply(ResponseStatus.ERROR, this.keyguardResult);
        } else if (this.keyguardResult) return;

        const key = await WalletStore.Instance.get(this.request.walletId);
        if (!key) throw new Error('Wallet ID not found');

        const request: KExportWordsRequest = {
            appName: this.request.appName,
            keyId: this.request.walletId,
            keyLabel: key.label,
        };

        const client = RpcApi.createKeyguardClient(this.$store, staticStore);
        client.exportWords(request).catch(console.error); // TODO: proper error handling
    }
}
</script>
