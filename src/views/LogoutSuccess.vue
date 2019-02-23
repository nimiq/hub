<template>
    <div class="container pad-bottom">
        <SmallPage>
            <Loader title="You are logged out." state="success"/>
        </SmallPage>
    </div>
</template>

<script lang="ts">
import { Component, Emit, Vue } from 'vue-property-decorator';
import { ParsedLogoutRequest } from '../lib/RequestTypes';
import { State } from 'vuex-class';
import { SmallPage } from '@nimiq/vue-components';
import { WalletStore } from '@/lib/WalletStore';
import { Static } from '@/lib/StaticStore';
import Loader from '../components/Loader.vue';
import KeyguardClient from '@nimiq/keyguard-client';

@Component({components: {Loader, SmallPage}})
export default class LogoutSuccess extends Vue {
    @Static private request!: ParsedLogoutRequest;
    @State private keyguardResult!: KeyguardClient.SimpleResult;

    public mounted() {
        WalletStore.Instance.remove(this.request.walletId);

        setTimeout(() => this.$rpc.resolve(this.keyguardResult), Loader.SUCCESS_REDIRECT_DELAY);
    }
}
</script>
