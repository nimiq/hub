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
import CookieJar from '../lib/CookieJar';
import NotEnoughCookieSpace from '../components/NotEnoughCookieSpace.vue';

@Component({components: {NotEnoughCookieSpace}})
export default class Login extends Vue {
    @Static private request!: ParsedBasicRequest;

    private notEnoughCookieSpace = false;

    public created() {
        if ((BrowserDetection.isIOS() || BrowserDetection.isSafari()) && !CookieJar.canFitNewAccount()) {
            this.notEnoughCookieSpace = true;
            return;
        }

        const request: KeyguardClient.ImportRequest = {
            appName: this.request.appName,
            requestedKeyPaths: [DEFAULT_KEY_PATH],
        };

        const client = this.$rpc.createKeyguardClient();
        client.import(request);
    }
}
</script>
