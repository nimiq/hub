<template>
    <div class="container">
        <small-page v-if="$route.name === `export-file-success`">
            <router-view/>
        </small-page>
        <!-- <a class="global-close" :class="{hidden: $route.name === `export-file-success`}" @click="close">Back to {{ request.appName }}</a> -->
    </div>
</template>

<script lang="ts">
import {Component, Emit, Watch, Vue} from 'vue-property-decorator';
import {SmallPage} from '@nimiq/vue-components';
import {ParsedExportFileRequest, ExportFileResult} from '../lib/RequestTypes';
import {State} from 'vuex-class';
import RpcApi from '../lib/RpcApi';
import {ExportFileRequest, ExportFileResult as KExportFileResult} from '@nimiq/keyguard-client';
import {State as RpcState, ResponseStatus} from '@nimiq/rpc';
import { KeyStore } from '@/lib/KeyStore';
import staticStore, {Static} from '../lib/StaticStore';

@Component({components: {SmallPage}})
export default class ExportFile extends Vue {
    @Static private rpcState!: RpcState;
    @Static private request!: ParsedExportFileRequest;
    @State private keyguardResult!: KExportFileResult | Error | null;

    public async created() {
        if (this.keyguardResult instanceof Error) {
            this.rpcState.reply(ResponseStatus.ERROR, this.keyguardResult);
        } else if (this.keyguardResult) return;

        const key = await KeyStore.Instance.get(this.request.keyId);
        if (!key) throw new Error('KeyId not found');

        const request: ExportFileRequest = {
            appName: this.request.appName,
            keyId: this.request.keyId,
            keyLabel: key.label,
        };

        const client = RpcApi.createKeyguardClient(this.$store, staticStore);
        client.exportFile(request).catch(console.error); // TODO: proper error handling
    }
}
</script>
