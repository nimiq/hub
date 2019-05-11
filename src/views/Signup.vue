<template>
    <NotEnoughCookieSpace v-if='notEnoughCookieSpace'/>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import KeyguardClient from '@nimiq/keyguard-client';
import { BrowserDetection } from '@nimiq/utils';
import { ParsedBasicRequest } from '../lib/RequestTypes';
import { Static } from '../lib/StaticStore';
import { DEFAULT_KEY_PATH } from '@/lib/Constants';
import CookieHelper from '../lib/CookieHelper';
import NotEnoughCookieSpace from '../components/NotEnoughCookieSpace.vue';

@Component({components: {NotEnoughCookieSpace}})
export default class Signup extends Vue {
    @Static private request!: ParsedBasicRequest;

    private notEnoughCookieSpace = false;

    public async created() {
        if ((BrowserDetection.isIOS() || BrowserDetection.isSafari()) && !await CookieHelper.canFitNewWallets()) {
            this.notEnoughCookieSpace = true;
            return;
        }

        const request: KeyguardClient.CreateRequest = {
            appName: this.request.appName,
            defaultKeyPath: DEFAULT_KEY_PATH,
        };
        const client = this.$rpc.createKeyguardClient();
        client.create(request);
    }
}
</script>
