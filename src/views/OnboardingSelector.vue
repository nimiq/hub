<template>
    <NotEnoughCookieSpace v-if='notEnoughCookieSpace'/>
    <div v-else class="container" :class="{isCheckoutOnboarding}">
        <h1 v-if="isCheckoutOnboarding" class="uber-header">Pay with Nimiq</h1>
        <div class="center">
            <OnboardingMenu @signup="signup" @login="login" @ledger="ledger"/>

            <button v-if="!request.disableBack" class="global-close nq-button-s" @click="close">
                <ArrowLeftSmallIcon/>
                Back to {{isCheckoutOnboarding ? 'Checkout' : (isChooseAddressOnboarding ? 'Choose Address' : request.appName)}}
            </button>
        </div>
        <div v-if="isCheckoutOnboarding" class="uber-header"><!-- bottom spacing to balance header --></div>
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
import CookieHelper from '../lib/CookieHelper';
import NotEnoughCookieSpace from '../components/NotEnoughCookieSpace.vue';
import { ArrowLeftSmallIcon } from '@nimiq/vue-components';

@Component({components: {OnboardingMenu, NotEnoughCookieSpace, ArrowLeftSmallIcon}})
export default class OnboardingSelector extends Vue {
    @Static private request!: ParsedBasicRequest;
    @Static private originalRouteName?: string;

    private notEnoughCookieSpace = false;

    public async created() {
        if ((BrowserDetection.isIOS() || BrowserDetection.isSafari()) && !await CookieHelper.canFitNewWallets()) {
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
        if (this.isCheckoutOnboarding || this.isChooseAddressOnboarding) {
            window.history.back();
        } else {
            this.$rpc.reject(new Error(ERROR_CANCELED));
        }
    }

    private get isCheckoutOnboarding() {
        return this.originalRouteName === RequestType.CHECKOUT;
    }

    private get isChooseAddressOnboarding() {
        return this.originalRouteName === RequestType.CHOOSE_ADDRESS;
    }
}
</script>

<style>
    .container.isCheckoutOnboarding {
        justify-content: space-around !important;
    }

    .uber-header {
        font-size: 5rem;
        margin-top: 2rem;
        margin-bottom: 6rem;
    }

    .center {
        text-align: center;
        width: 100%;
    }

    .onboarding-menu {
        margin: auto !important;
    }

    @media (max-height: 700px) {
        .uber-header:last-child {
            margin-bottom: 0;
        }
    }

    @media (max-height: 580px), (max-width: 420px) {
        .uber-header:last-child {
            display: none;
        }
    }
</style>
