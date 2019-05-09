<template>
    <NotEnoughCookieSpace v-if='notEnoughCookieSpace'/>
    <div v-else class="container">
        <OnboardingMenu @signup="signup" @login="login" @ledger="ledger"/>

        <button v-if="!request.disableBack" class="global-close nq-button-s" @click="close">
            <span class="nq-icon arrow-left"></span>
            Back to {{request.appName}}
        </button>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import KeyguardClient from '@nimiq/keyguard-client';
import { BrowserDetection } from '@nimiq/utils';
import OnboardingMenu from '../components/OnboardingMenu.vue';
import { ParsedBasicRequest, RequestType } from '@/lib/RequestTypes';
import { Static } from '@/lib/StaticStore';
import { DEFAULT_KEY_PATH, ERROR_CANCELED } from '@/lib/Constants';
import CookieJar from '../lib/CookieJar';
import NotEnoughCookieSpace from '../components/NotEnoughCookieSpace.vue';

@Component({components: {OnboardingMenu, NotEnoughCookieSpace}})
export default class OnboardingSelector extends Vue {
    @Static private request!: ParsedBasicRequest;

    private notEnoughCookieSpace = false;

    public created() {
        if ((BrowserDetection.isIOS() || BrowserDetection.isSafari()) && !CookieJar.canFitNewAccount()) {
            this.notEnoughCookieSpace = true;
            return;
        }
    }

    private signup() {
        const request: KeyguardClient.CreateRequest = {
            appName: this.request.appName,
            defaultKeyPath: DEFAULT_KEY_PATH,
        };
        const client = this.$rpc.createKeyguardClient();
        client.create(request);
    }

    private login() {
        const request: KeyguardClient.ImportRequest = {
            appName: this.request.appName,
            requestedKeyPaths: [DEFAULT_KEY_PATH],
        };
        const client = this.$rpc.createKeyguardClient();
        client.import(request);
    }

    private ledger() {
        this.$rpc.routerPush(`${RequestType.SIGNUP}-ledger`);
    }

    private close() {
        this.$rpc.reject(new Error(ERROR_CANCELED));
    }
}
</script>
