<template>
    <NotEnoughCookieSpace v-if='notEnoughCookieSpace'/>
    <div v-else class="container" :class="{'has-heading': headerText}">
        <div class="headline-container">
            <h1 v-if="headerText" class="uber-header">{{ headerText }}</h1>
            <p v-if="sublineText" class="nq-text subline-text"> {{ sublineText }}</p>
        </div>
        <div class="center">
            <OnboardingMenu @signup="signup" @login="login" @ledger="ledger"/>

            <GlobalClose v-if="!request.disableBack" :buttonLabel="backButtonLabel" :onClose="close"/>
        </div>
        <div v-if="headerText" class="uber-footer"><!-- bottom spacing to balance header --></div>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import KeyguardClient from '@nimiq/keyguard-client';
import { BrowserDetection } from '@nimiq/utils';
import GlobalClose from '../components/GlobalClose.vue';
import OnboardingMenu from '../components/OnboardingMenu.vue';
import { ParsedOnboardRequest } from '@/lib/RequestTypes';
import { RequestType } from '@/lib/PublicRequestTypes';
import { Static } from '@/lib/StaticStore';
import { DEFAULT_KEY_PATH, ERROR_CANCELED } from '@/lib/Constants';
import CookieHelper from '../lib/CookieHelper';
import NotEnoughCookieSpace from '../components/NotEnoughCookieSpace.vue';

@Component({components: {GlobalClose, OnboardingMenu, NotEnoughCookieSpace}})
export default class OnboardingSelector extends Vue {
    @Static private request!: ParsedOnboardRequest;
    @Static private originalRouteName?: string;

    private notEnoughCookieSpace = false;

    public async created() {
        this.notEnoughCookieSpace = (BrowserDetection.isIOS() || BrowserDetection.isSafari())
            && !await CookieHelper.canFitNewWallets();
    }

    private signup() {
        const request: KeyguardClient.CreateRequest = {
            appName: this.request.appName,
            defaultKeyPath: DEFAULT_KEY_PATH,
            enableBackArrow: true,
        };
        const client = this.$rpc.createKeyguardClient();
        client.create(request);
    }

    private login() {
        const request: KeyguardClient.ImportRequest = {
            appName: this.request.appName,
            requestedKeyPaths: [DEFAULT_KEY_PATH],
            enableBackArrow: true,
        };
        const client = this.$rpc.createKeyguardClient();
        client.import(request);
    }

    private ledger() {
        this.$router.push({name: `${RequestType.SIGNUP}-ledger`});
    }

    private close() {
        if (this.isSecondaryOnboarding) {
            window.history.back();
        } else {
            this.$rpc.reject(new Error(ERROR_CANCELED));
        }
    }

    private get backButtonLabel() {
        switch (this.originalRouteName) {
            case RequestType.CHECKOUT:
                return this.$t('Back to Checkout') as string;
            case RequestType.CHOOSE_ADDRESS:
                return this.$t('Back to Choose Address') as string;
            case RequestType.SIGN_MESSAGE:
                return this.$t('Back to Sign Message') as string;
            case RequestType.CREATE_CASHLINK:
                return this.$t('Back to Cashlink') as string;
            default:
                return ''; // use default label
        }
    }

    private get headerText() {
        switch (this.originalRouteName) {
            case undefined:
                return this.$t('Join Nimiq') as string;
            case RequestType.CHECKOUT:
                return this.$t('Pay with Nimiq') as string;
            case RequestType.CREATE_CASHLINK:
                return this.$t('Login to fund your Cashlink') as string;
            default:
                return undefined;
        }
    }

    private get sublineText() {
        switch (this.originalRouteName) {
            case undefined:
                return this.$t('No registration, no install,\n100% free') as string;
            default:
                return undefined;
        }
    }

    private get isSecondaryOnboarding() {
        return this.originalRouteName === RequestType.CHECKOUT
            || this.originalRouteName === RequestType.CHOOSE_ADDRESS
            || this.originalRouteName === RequestType.SIGN_MESSAGE
            || this.originalRouteName === RequestType.CREATE_CASHLINK;
    }
}
</script>

<style scoped>
    .container.has-heading {
        justify-content: space-around !important;
    }

    .headline-container,
    .uber-footer {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        margin-top: 6rem;
    }

    .uber-header {
        font-size: 5rem;
        margin: 0;
    }

    .subline-text {
        font-size: 2rem;
        font-weight: 600;
        color: rgba(31, 35, 72, 0.6);
        white-space: pre-line;
        text-align: center;
    }

    .center {
        text-align: center;
        width: 100%;
    }

    .onboarding-menu {
        margin: auto !important;
    }

    @media (max-width: 450px) {
        .headline-container {
            flex-grow: 1;
            margin-top: 2rem;
        }

        .subline-text {
            font-size: 2.125rem;
        }

        .onboarding-menu {
            height: 55rem;
        }

        .uber-footer {
            display: none;
        }
    }
</style>
