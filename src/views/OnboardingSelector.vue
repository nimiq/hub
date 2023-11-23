<template>
    <NotEnoughCookieSpace v-if='notEnoughCookieSpace'/>
    <div v-else-if="shouldRender" class="container" :class="{'has-heading': headerText}">
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
import { State as RpcState } from '@nimiq/rpc';
import GlobalClose from '../components/GlobalClose.vue';
import OnboardingMenu from '../components/OnboardingMenu.vue';
import { ParsedOnboardRequest } from '@/lib/RequestTypes';
import { RequestType } from '../../client/PublicRequestTypes';
import { Static } from '@/lib/StaticStore';
import { DEFAULT_KEY_PATH, ERROR_CANCELED } from '@/lib/Constants';
import CookieHelper from '../lib/CookieHelper';
import NotEnoughCookieSpace from '../components/NotEnoughCookieSpace.vue';
import { BTC_ACCOUNT_KEY_PATH } from '../lib/bitcoin/BitcoinConstants';
import { POLYGON_ACCOUNT_KEY_PATH } from '../lib/polygon/PolygonConstants';
import Config from 'config';
import CookieJar from '../lib/CookieJar';
import { WalletStore } from '../lib/WalletStore';
import { WalletInfo } from '../lib/WalletInfo';
import { includesOrigin } from '../lib/Helpers';

@Component({components: {GlobalClose, OnboardingMenu, NotEnoughCookieSpace}})
export default class OnboardingSelector extends Vue {
    @Static private request!: ParsedOnboardRequest;
    @Static private rpcState!: RpcState;
    @Static private originalRouteName?: string;

    private notEnoughCookieSpace = false;
    private shouldRender: boolean | null = null;

    public async created() {
        /**
         * On iOS/Safari, especially when the Wallet is installed to homescreen, the Hub sometimes deletes its cookie,
         * even before 7 days are over (it should not delete any data in a PWA context, but maybe because the Hub is a
         * non-first-party domain to the PWA and opens in a webview, it is still affected?). The IndexedDB in the
         * webview is still present then.
         *
         * This deletion of the Hub cookie leads to the Wallet triggering the onboarding flow. This check uses this and
         * short-circuits the onboarding request by simply responding with a full list of accounts, which also sets the
         * cookie (through the `_reply` function in `RpcApi`).
         */
        const isPrivileged = includesOrigin(Config.privilegedOrigins, this.rpcState.origin);
        if (isPrivileged && (BrowserDetection.isIOS() || BrowserDetection.isSafari())) {
            const cookieAccounts = await CookieJar.eat();
            if (!cookieAccounts.length) {
                const dbAccounts = await WalletStore.Instance.list();
                if (dbAccounts.length) {
                    this.shouldRender = false;

                    const result = await Promise.all(
                        dbAccounts.map(async (entry) => {
                            const walletInfo = WalletInfo.fromObject(entry);
                            return walletInfo!.toAccountType(RequestType.ONBOARD);
                        }),
                    );
                    this.$rpc.resolve(result);
                }
            }
        }

        this.notEnoughCookieSpace = (BrowserDetection.isIOS() || BrowserDetection.isSafari())
            && !await CookieHelper.canFitNewWallets();

        if (this.shouldRender === null) {
            this.shouldRender = true;
        }
    }

    private signup() {
        const request: KeyguardClient.CreateRequest = {
            appName: this.request.appName,
            defaultKeyPath: DEFAULT_KEY_PATH,
            enableBackArrow: true,
            bitcoinXPubPath: BTC_ACCOUNT_KEY_PATH[Config.bitcoinAddressType][Config.bitcoinNetwork],
            polygonAccountPath: POLYGON_ACCOUNT_KEY_PATH[Config.polygonNetwork],
        };
        const client = this.$rpc.createKeyguardClient();
        client.create(request);
    }

    private login() {
        const request: KeyguardClient.ImportRequest = {
            appName: this.request.appName,
            requestedKeyPaths: [DEFAULT_KEY_PATH],
            enableBackArrow: true,
            bitcoinXPubPath: BTC_ACCOUNT_KEY_PATH[Config.bitcoinAddressType][Config.bitcoinNetwork],
            polygonAccountPath: POLYGON_ACCOUNT_KEY_PATH[Config.polygonNetwork],
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
                return this.$t('Welcome to the Nimiq Wallet') as string;
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
                return this.$t('A 100% free and self-custodial web wallet for NIM, BTC and USDC.') as string;
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
        color: var(--nimiq-blue);
        white-space: pre-line;
        text-align: center;
        word-wrap: balance;
        max-width: 40rem;
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
