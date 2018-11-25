<template>
    <div class="container pad-bottom">
        <SmallPage>
            <Success
                text="Your Logout[br]was successful"
                :appName="request.appName"
                @continue="done"
                />
        </SmallPage>
    </div>
</template>

<script lang="ts">
import { Component, Emit, Vue } from 'vue-property-decorator';
import { ParsedLogoutRequest } from '../lib/RequestTypes';
import { State } from 'vuex-class';
import { SmallPage } from '@nimiq/vue-components';
import { SimpleResult } from '@nimiq/keyguard-client';
import { WalletStore } from '@/lib/WalletStore';
import { Static } from '@/lib/StaticStore';
import Success from '../components/Success.vue';

@Component({components: {Success, SmallPage}})
export default class LogoutSuccess extends Vue {
    @Static private request!: ParsedLogoutRequest;
    @State private keyguardResult!: SimpleResult;

    public mounted() {
        WalletStore.Instance.remove(this.request.walletId);
    }

    @Emit()
    private done() {
        this.$rpc.resolve(this.keyguardResult);
    }
}
</script>
