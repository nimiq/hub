<template>
    <div class="container">
        <small-page v-if="$route.name === `logout-success`">
            <router-view/>
        </small-page>
        <!-- <a class="global-close" :class="{hidden: $route.name === `logout-success`}" @click="close">Back to {{ request.appName }}</a> -->
    </div>
</template>

<script lang="ts">
import { Component, Emit, Watch, Vue } from 'vue-property-decorator';
import { SmallPage } from '@nimiq/vue-components';
import { ParsedLogoutRequest } from '../lib/RequestTypes';
import { State } from 'vuex-class';
import RpcApi from '../lib/RpcApi';
import { RemoveKeyRequest, RemoveKeyResult } from '@nimiq/keyguard-client';
import { State as RpcState, ResponseStatus } from '@nimiq/rpc';
import { WalletStore } from '@/lib/WalletStore';
import staticStore, { Static } from '../lib/StaticStore';

@Component({components: {SmallPage}})
export default class Logout extends Vue {
    @Static private rpcState!: RpcState;
    @Static private request!: ParsedLogoutRequest;
    @State private keyguardResult!: RemoveKeyResult | Error | null;

    public async created() {
        if (this.keyguardResult instanceof Error) {
            this.rpcState.reply(ResponseStatus.ERROR, this.keyguardResult);
        } else if (this.keyguardResult) return; // Keyguard success is handled in LogoutSuccess.vue

        const key = await WalletStore.Instance.get(this.request.walletId);
        if (!key) throw new Error('Wallet ID not found');

        const request: RemoveKeyRequest = {
            appName: this.request.appName,
            keyId: this.request.walletId,
            keyLabel: key.label,
        };

        const client = RpcApi.createKeyguardClient(this.$store, staticStore);
        client.remove(request).catch(console.error); // TODO: proper error handling
    }

    // @Emit()
    // private close() {
    //     window.close();
    // }
}
</script>
