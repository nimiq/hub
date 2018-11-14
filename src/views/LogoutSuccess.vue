<template>
    <div class="container">
        <small-page>
            <Success
                text="Your Logout[br]was successful"
                :appName="request.appName"
                @continue="done"
                />
        </small-page>
    </div>
</template>

<script lang="ts">
import { Component, Emit, Vue } from 'vue-property-decorator';
import { ParsedLogoutRequest } from '../lib/RequestTypes';
import { State } from 'vuex-class';
import { ResponseStatus, State as RpcState } from '@nimiq/rpc';
import { SmallPage } from '@nimiq/vue-components';
import { RemoveKeyResult } from '@nimiq/keyguard-client';
import { WalletStore } from '@/lib/WalletStore';
import { Static } from '@/lib/StaticStore';
import Success from '../components/Success.vue';

@Component({components: {Success, SmallPage}})
export default class LogoutSuccess extends Vue {
    @Static private request!: ParsedLogoutRequest;
    @Static private rpcState!: RpcState;
    @State private keyguardResult!: RemoveKeyResult;

    public mounted() {
        if (this.keyguardResult.success !== true) {
            this.rpcState.reply(ResponseStatus.ERROR, this.keyguardResult);
        }
        WalletStore.Instance.remove(this.request.walletId);
    }

    @Emit()
    private done() {
        this.rpcState.reply(ResponseStatus.OK, this.keyguardResult);
    }
}
</script>
