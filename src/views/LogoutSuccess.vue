<template>
    <div class="container">
        <small-page>
            <Success
                successText="Your Logout was successful"
                v-bind:appName="this.request.appName"
                v-bind:close="this.done"
                />
        </small-page>
    </div>
</template>

<script lang="ts">
import { Component, Emit, Vue } from 'vue-property-decorator';
import { ParsedLogoutRequest } from '../lib/RequestTypes';
import { State } from 'vuex-class';
import { KeyInfo, KeyStorageType } from '../lib/KeyInfo';
import { ResponseStatus, State as RpcState } from '@nimiq/rpc';
import { SmallPage } from '@nimiq/vue-components';
import { RemoveKeyResult } from '@nimiq/keyguard-client';
import { AddressInfo } from '@/lib/AddressInfo';
import { KeyStore } from '@/lib/KeyStore';
import { Static } from '@/lib/StaticStore';
import Success from '../components/Success.vue';

@Component({components: {Success, SmallPage}})
export default class LogoutSuccess extends Vue {
    @Static private request!: ParsedLogoutRequest;
    @Static private rpcState!: RpcState;
    @State private keyguardResult!: RemoveKeyResult;

    public mounted() {
        if (this.keyguardResult instanceof Error || this.keyguardResult.success !== true) {
            this.rpcState.reply(ResponseStatus.ERROR, this.keyguardResult);
        }
        KeyStore.Instance.remove(this.request.keyId);
    }

    @Emit()
    private done() {
        this.rpcState.reply(ResponseStatus.OK, this.keyguardResult);
    }
}
</script>
