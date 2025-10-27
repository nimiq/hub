<template>
    <div class="container pad-bottom" :class="{ themed: themeBackground, 'dark-theme': isDarkTheme }">
        <img v-if="themeBackground && !isMobile"
            :src="`/img/cashlink-themes/${themeBackground}.svg`"
            class="theme-background theme-background-desktop"
            :class="themeBackground"
            @load="$event.target.style.opacity = 1"
        >
        <SmallPage v-if="cashlink || statusState">
            <transition name="transition-fade">
                <StatusScreen v-if="statusState"
                    :state="statusState"
                    :title="statusTitle"
                    :status="statusStatus"
                    :message="statusMessage"
                    :mainAction="$t('Got it')"
                    @main-action="redirectToWallet"
                />
            </transition>
            <div v-if="cashlink && hasWallets" class="card-content has-account" :class="{ 'account-selector-shown': !!isAccountSelectorOpened }">
                <PageHeader class="blur-target">{{ $t('You received a USDT Cashlink!') }}</PageHeader>
                <PageBody>
                    <div class="accounts" :class="{'single-address': addressCount === 1}">
                        <Account class="cashlink-account blur-target" layout="column"
                            :displayAsCashlink="true"
                            label="USDT Cashlink"/>
                        <ArrowRightIcon class="arrow-right blur-target"/>
                        <div v-if="addressCount > 1 && activeAccount" class="recipient-button blur-target">
                            <button class="nq-button-s" @click="isAccountSelectorOpened = true;">{{ $t('Change') }}</button>
                            <Account layout="column"
                                :address="activeAccount.userFriendlyAddress"
                                :label="activeAccount.label"/>
                        </div>
                        <Account v-else-if="activeAccount" layout="column"
                            :address="activeAccount.userFriendlyAddress"
                            :label="activeAccount.label"/>
                    </div>

                    <hr class="blur-target"/>

                    <div>
                        <div class="value nq-light-blue blur-target">
                            {{ formatUsdtAmount(cashlink.value) }} <span class="currency">USDT</span>
                        </div>

                        <div v-if="cashlink.message" class="data nq-text blur-target">
                            {{ cashlink.message }}
                        </div>
                    </div>
                    <div><!-- bottom flex spacer --></div>
                </PageBody>
                <PageFooter>
                    <button
                        class="nq-button light-blue blur-target"
                        :disabled="!canCashlinkBeClaimed"
                        @click="claim"
                    ><CircleSpinner v-if="isButtonLoading"/>{{ buttonText }}</button>
                </PageFooter>

                <transition name="transition-fade">
                    <div v-if="isAccountSelectorOpened" class="overlay">
                        <CloseButton class="top-right" @click="isAccountSelectorOpened = false" />
                        <PageHeader>{{ $t('Choose an Address') }}</PageHeader>
                        <AccountSelector
                            :wallets="processedWallets"
                            :disableContracts="true"
                            @account-selected="accountSelected"
                            @login="callHub('login')"
                        />
                    </div>
                </transition>
            </div>
            <div v-if="cashlink && !hasWallets" class="card-content no-account">
                <div class="top-spacer"><!-- top flex spacer --></div>

                <CashlinkSparkle/>

                <div>
                    <div class="value nq-light-blue">
                        {{ formatUsdtAmount(cashlink.value) }} <span class="currency">USDT</span>
                    </div>

                    <div v-if="cashlink.message" class="data nq-text">
                        {{ cashlink.message }}
                    </div>
                </div>

                <PageFooter>
                    <button class="nq-button light-blue" @click="callHub('signup')">{{ $t('Create account') }}</button>
                    <a class="nq-link skip" href="javascript:void(0)" @click="callHub('onboard')">
                        {{ $t('Login to existing account') }}
                        <CaretRightSmallIcon/>
                    </a>
                </PageFooter>
            </div>
        </SmallPage>

        <div v-if="(cashlink && !hasWallets) || isMobile" class="outside-container">
            <img v-if="themeBackground && isMobile"
                 :src="`/img/cashlink-themes/${themeBackground}${hasMobileTheme ? '-mobile' : ''}.svg`"
                 class="theme-background theme-background-mobile"
                 :class="themeBackground"
                 @load="$event.target.style.opacity = 1"
            >
            <div v-if="cashlink && !hasWallets" class="welcome-text">
                <h1 class="nq-h1">{{ welcomeHeadline }}</h1>
                <p class="nq-text">
                    {{ welcomeText }}
                    {{ $t('Create an account and claim your money.') }}
                    <span class="secondary-text">{{ $t('30\u00a0seconds, no\u00a0email, no\u00a0download.') }}</span>
                </p>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import {
    SmallPage,
    PageHeader,
    PageBody,
    PageFooter,
    ArrowRightIcon,
    CaretRightSmallIcon,
    CloseButton,
    Account,
    AccountSelector,
} from '@nimiq/vue-components';
import StatusScreen from '../components/StatusScreen.vue';
import CashlinkSparkle from '../components/CashlinkSparkle.vue';
import CircleSpinner from '../components/CircleSpinner.vue';
import CashlinkInteractive from '../lib/CashlinkInteractive';
import { BasicRequest, CashlinkTheme, CashlinkCurrency } from '../../client/PublicRequestTypes';
import { CashlinkState } from '../lib/CashlinkInteractive';
import { AccountInfo } from '../lib/AccountInfo';
import { Getter, Mutation } from 'vuex-class';
import Config from 'config';
import { WalletInfo } from '../lib/WalletInfo';
import { CashlinkStore } from '../lib/CashlinkStore';
import HubApi from '../../client/HubApi';

@Component({components: {
    SmallPage,
    StatusScreen,
    CashlinkSparkle,
    CircleSpinner,
    PageHeader,
    PageBody,
    PageFooter,
    ArrowRightIcon,
    CaretRightSmallIcon,
    CloseButton,
    Account,
    AccountSelector,
}})
class UsdtCashlinkReceive extends Vue {
    private static MOBILE_BREAKPOINT = 450;
    private static Events = {
        THEME_CHANGED: 'theme-change',
    };

    @Getter private addressCount!: number;
    @Getter private hasWallets!: boolean;
    @Getter private activeAccount?: AccountInfo;
    @Getter private processedWallets!: WalletInfo[];

    @Mutation('setActiveAccount') private $setActiveAccount!:
        (payload: {walletId: string, userFriendlyAddress: string}) => any;

    private cashlink: CashlinkInteractive | null = null;
    private isAccountSelectorOpened: boolean = false;
    private isClaiming: boolean = false;
    private isMobile: boolean = false;

    private statusState: StatusScreen.State | false = false;
    private statusTitle = '';
    private statusStatus = '';
    private statusMessage = '';

    public created() {
        const handler = (result: any, storedData: {url: string}) => {
            if (storedData.url) {
                window.history.replaceState(window.history.state, '', storedData.url);
            }
        };

        const hubApi = new HubApi();
        hubApi.on(HubApi.RequestType.SIGNUP, handler, handler);
        hubApi.on(HubApi.RequestType.LOGIN, handler, handler);
        hubApi.on(HubApi.RequestType.ONBOARD, handler, handler);
        hubApi.checkRedirectResponse();

        this._onResize = this._onResize.bind(this);
        window.addEventListener('resize', this._onResize);
        this._onResize();
    }

    public async mounted() {
        // Load USDT Cashlink from URL
        const CashlinkModule = await import('../lib/Cashlink');
        const parsedCashlink = await CashlinkModule.default.parse(window.location.hash.substring(1));

        // Fail if no Cashlink was found or if it's not a USDT cashlink
        if (!parsedCashlink || parsedCashlink.currency !== CashlinkCurrency.USDT) {
            this.statusState = StatusScreen.State.WARNING;
            this.statusTitle = this.$t('404 - Cash not found') as string;
            this.statusMessage = this.$t('This is not a valid USDT Cashlink, sorry.') as string;
            return;
        }

        this.cashlink = new CashlinkInteractive(parsedCashlink);

        if (this.cashlink.theme) {
            this.$emit(UsdtCashlinkReceive.Events.THEME_CHANGED, this.cashlink.theme, this.isDarkTheme);
        }

        // When user has no wallets, skip cashlink init
        if (!this.hasWallets) return;

        // Set dependencies for the cashlink to connect to network
        const wallets = this.$store.state.wallets;
        this.cashlink.setUserWallets(wallets);
    }

    public destroyed() {
        window.removeEventListener('resize', this._onResize);
    }

    private async claim() {
        this.statusState = StatusScreen.State.LOADING;
        this.statusTitle = this.$t('Claiming USDT Cashlink') as string;
        this.statusStatus = this.$t('Connecting to Polygon...') as string;

        this.isClaiming = true;

        // Get Polygon address from active account
        const activeWallet = this.$store.state.wallets.find((w: WalletInfo) =>
            w.id === this.$store.state.activeWalletId);
        if (!activeWallet || !activeWallet.polygonAddresses || !activeWallet.polygonAddresses.length) {
            this.statusState = StatusScreen.State.WARNING;
            this.statusTitle = this.$t('No Polygon address') as string;
            this.statusMessage = this.$t('Please activate Polygon for this account first.') as string;
            return;
        }

        const recipientPolygonAddress = activeWallet.polygonAddresses[0].address;

        try {
            // Claim the cashlink (this will sign and relay the transaction)
            await this.cashlink!.claim(recipientPolygonAddress);

            // Store claimed cashlink
            try {
                await CashlinkStore.Instance.put(this.cashlink!);
            } catch (err) {
                console.error('Error storing claimed cashlink:', err);
            }

            // Show success
            this.statusState = StatusScreen.State.SUCCESS;
            this.statusTitle = this.$t('USDT Cashlink claimed!') as string;

            window.setTimeout(() => this.redirectToWallet(), StatusScreen.SUCCESS_REDIRECT_DELAY);
        } catch (error) {
            console.error('Error claiming USDT Cashlink:', error);
            this.statusState = StatusScreen.State.WARNING;
            this.statusTitle = this.$t('Claiming failed') as string;
            this.statusMessage = (error as Error).message;
        }
    }

    private accountSelected(walletId: string, userFriendlyAddress: string) {
        this.$setActiveAccount({ walletId, userFriendlyAddress });
        this.isAccountSelectorOpened = false;
    }

    private callHub(method: 'signup' | 'login' | 'onboard') {
        const request: BasicRequest = {
            appName: 'USDT Cashlink',
        };

        const redirectBehavior = new HubApi.RedirectRequestBehavior(undefined, { url: window.location.href });
        const hubApi = new HubApi(undefined, redirectBehavior);

        switch (method) {
            case 'signup': hubApi.signup(request); break;
            case 'login': hubApi.login(request); break;
            case 'onboard': hubApi.onboard(request); break;
        }
    }

    private redirectToWallet() {
        window.location.href = Config.redirectTarget;
    }

    private get isCashlinkStateKnown(): boolean {
        return this.cashlink!.state !== CashlinkState.UNKNOWN;
    }

    private get canCashlinkBeClaimed(): boolean {
        return this.cashlink!.state === CashlinkState.UNCLAIMED;
    }

    private get buttonText(): string {
        if (!this.isCashlinkStateKnown) return this.$t('Checking status') as string;
        else if (this.canCashlinkBeClaimed) return this.$t('Claim USDT Cashlink') as string;
        else if (this.cashlink!.state === CashlinkState.UNCHARGED) return this.$t('Cashlink not funded') as string;
        else if (this.cashlink!.state === CashlinkState.CHARGING) return this.$t('Cashlink funding') as string;
        else {
            if (!this.isClaiming) {
                this.statusState = StatusScreen.State.WARNING;
                this.statusTitle = this.$t('Cashlink is empty') as string;
                this.statusMessage = this.$t('This USDT Cashlink has already been claimed.') as string;
            }
            return this.$t('Cashlink empty :(') as string;
        }
    }

    private get isButtonLoading(): boolean {
        return !this.isCashlinkStateKnown || this.cashlink!.state === CashlinkState.CHARGING;
    }

    private get themeBackground(): string | null {
        return this.cashlink && this.cashlink.theme !== CashlinkTheme.STANDARD
            ? `${CashlinkTheme[this.cashlink.theme].toLowerCase().replace(/_/g, '-')}`
            : null;
    }

    private get isDarkTheme(): boolean {
        return !!this.cashlink && this.cashlink.theme === CashlinkTheme.LUNAR_NEW_YEAR;
    }

    private get hasMobileTheme(): boolean {
        const theme = this.cashlink ? this.cashlink.theme : CashlinkTheme.STANDARD;
        switch (theme) {
            case CashlinkTheme.STANDARD:
            case CashlinkTheme.EASTER:
            case CashlinkTheme.BIRTHDAY:
                return false;
            default:
                return true;
        }
    }

    private get welcomeHeadline(): string {
        const theme = this.cashlink ? this.cashlink.theme : CashlinkTheme.STANDARD;
        switch (theme) {
            case CashlinkTheme.GENERIC:
            case CashlinkTheme.CHRISTMAS:
            case CashlinkTheme.LUNAR_NEW_YEAR:
                return this.$t('You are loved') as string;
            case CashlinkTheme.EASTER:
                return this.$t('Happy Easter!') as string;
            case CashlinkTheme.BIRTHDAY:
                return this.$t('Happy birthday!') as string;
            default: return this.$t('Claim your USDT') as string;
        }
    }

    private get welcomeText(): string {
        return this.$t('Someone sent you USDT on Polygon!') as string;
    }

    private formatUsdtAmount(cents: number): string {
        return (cents / 1000000).toFixed(2);
    }

    private _onResize() {
        this.isMobile = window.innerWidth <= UsdtCashlinkReceive.MOBILE_BREAKPOINT;
    }
}

export default UsdtCashlinkReceive;
</script>

<style scoped>
    /* Copied from CashlinkReceive.vue */

    .container {
        flex-direction: row !important;
        padding: 0 5rem;
    }

    .theme-background {
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: opacity 1s var(--nimiq-ease);
        opacity: 0;
        z-index: -1;
    }

    .theme-background-desktop {
        position: fixed;
    }

    .theme-background-mobile {
        position: absolute;
        top: -7.5rem;
        height: calc(100% + 7.5rem + 1rem);
    }

    .theme-background.generic {
        object-position: center bottom;
    }

    .theme-background.christmas,
    .theme-background.lunar-new-year {
        object-position: right bottom;
    }

    .theme-background.easter {
        object-position: center 60%;
    }

    .theme-background.birthday {
        object-position: 70% bottom;
    }

    .card-content {
        display: flex;
        flex-direction: column;
        flex-grow: 1;
    }

    .card-content.no-account {
        align-items: center;
        justify-content: space-between;
    }

    .outside-container {
        display: flex;
        justify-content: center;
        align-items: center;
        align-self: stretch;
        position: relative;
    }

    .welcome-text {
        max-width: 514px;
        margin-left: 8.75rem;
    }

    .dark-theme .welcome-text {
        color: white;
    }

    .welcome-text .nq-h1 {
        font-size: 8rem;
        margin-top: 0;
        margin-bottom: 4rem;
    }

    .welcome-text .nq-text {
        font-size: 4rem;
        color: inherit;
    }

    .welcome-text .secondary-text {
        color: rgba(31, 35, 72, 0.5);
    }

    .dark-theme .welcome-text .secondary-text {
        color: rgba(255, 255, 255, .65);
    }

    .small-page {
        position: relative;
        overflow: hidden;
        transition: opacity .8s;
    }

    .page-header {
        padding: 0;
        margin: 4rem;
    }

    .page-body {
        display: flex;
        flex-direction: column;
        padding-bottom: 0;
        justify-content: space-between;
    }

    .page-footer {
        align-self: stretch;
        text-align: center;
    }

    .accounts {
        display: flex;
        align-self: stretch;
    }

    .cashlink-account {
        margin-top: 3rem;
    }

    .cashlink-account,
    .recipient-button {
        width: calc(50% - 1.5rem - 2.75rem);
    }

    .recipient-button .account >>> .identicon {
        height: 9rem;
    }

    .accounts .arrow-right {
        font-size: 3rem;
        margin: 8.125rem 2.75rem 0;
        color: var(--nimiq-light-blue);
        flex-shrink: 0;
    }

    .recipient-button {
        border: .25rem solid rgba(31, 35, 72, 0.1);
        border-radius: 0.5rem;
        display: flex;
        flex-direction: column;
        position: relative;
        padding-top: 3rem;
    }

    .recipient-button button {
        position: absolute;
        right: 0.75rem;
        top: 0.75rem;
        font-size: 1.5rem;
        line-height: 2.75rem;
        height: 2.75rem;
        padding: 0 1.125rem;
    }

    .recipient-button .account {
        padding-left: 0;
        padding-right: 0;
    }

    .accounts.single-address .cashlink-account {
        margin-top: 0;
        width: calc(50% - 2rem);
    }

    .accounts.single-address .arrow-right {
        margin: 5.125rem 0 0 auto;
    }

    hr {
        width: 100%;
        height: 1px;
        margin: 2rem 0;
        border: none;
        background: #1F2348;
        opacity: .1;
    }

    .value {
        display: block;
        text-align: center;
        font-size: 5rem;
        font-weight: bold;
    }

    .no-account .value {
        font-size: 8rem;
    }

    .value .currency {
        font-size: 0.45em;
        font-weight: 700;
        margin-left: 0.5rem;
    }

    .data {
        margin: 0.5rem 0 0;
        font-size: 2.5rem;
        color: var(--nimiq-blue);
        text-align: center;
        max-height: 9.75rem;
        overflow-wrap: break-word;
    }

    .no-account .data {
        margin-top: 1rem;
    }

    .nq-button >>> .circle-spinner {
        margin-right: 1.5rem;
        margin-bottom: -0.375rem;
    }

    .skip {
        font-size: 1.75rem;
        font-weight: 600;
        line-height: 2;
        color: inherit;
        margin: -1.5rem auto 1rem;
        padding: 0 2rem;
        opacity: 0.7;
        transition: opacity .3s var(--nimiq-ease);
    }

    .skip .nq-icon {
        height: 1.125rem;
        width: 1.125rem;
        transition: transform .3s var(--nimiq-ease);
        vertical-align: middle;
    }

    .skip:hover,
    .skip:focus {
        outline: none;
        opacity: 1;
        text-decoration: none;
    }

    .skip:hover .nq-icon,
    .skip:focus .nq-icon {
        transform: translate3D(-0.25rem, 0, 0);
    }

    .status-screen {
        position: absolute;
        transition: opacity .4s;
        z-index: 2;
    }

    .overlay {
        position: absolute;
        top: 0;
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        transition: opacity .4s;
        background: rgba(255, 255, 255, .875);
    }

    .account-selector {
        margin-top: -3rem;
    }

    .account-selector >>> .amount {
        display: none !important;
    }

    .blur-target {
        transition: filter .4s;
    }

    .account-selector-shown .blur-target {
        filter: blur(20px);
    }

    .account-selector-shown .page-footer {
        filter: blur(35px);
    }

    @media (max-width: 939px) {
        .container {
            padding: 0 4rem;
        }

        .welcome-text {
            margin-left: 5.75rem;
        }

        .welcome-text .nq-h1 {
            font-size: 5.5rem;
            margin-bottom: 3rem;
        }

        .welcome-text .nq-text {
            font-size: 3rem;
        }
    }

    @media (max-width: 799px) {
        .container {
            padding: 0 2.5rem;
        }

        .welcome-text {
            margin-left: 3.75rem;
        }

        .welcome-text .nq-h1 {
            font-size: 4rem;
            margin-bottom: 1.75rem;
        }

        .welcome-text .nq-text {
            margin-top: 1.75rem;
            font-size: 2.5rem;
        }
    }

    @media (max-width: 699px) {
        .container {
            flex-direction: column-reverse !important;
            padding: 0;
        }

        .small-page {
            height: auto !important;
        }

        .top-spacer {
            display: none;
        }

        .no-account .value {
            font-size: 6rem;
        }

        .no-account .data {
            font-size: 2rem;
        }

        .welcome-text {
            max-width: 420px;
            text-align: center;
            margin: 3rem 0 4rem;
            padding: 0 2rem;
        }
    }

    @media (max-width: 450px) {
        .welcome-text {
            font-weight: 600;
        }

        .welcome-text .nq-h1 {
            font-size: 3.5rem;
        }

        .welcome-text .nq-text {
            font-size: 1.875rem;
            line-height: 1.4;
        }

        .themed .outside-container {
            flex-grow: 1;
        }

        .container:not(.themed) .small-page {
            flex-grow: 1;
        }

        .theme-background.easter {
            object-position: 60% center;
        }

        .small-page {
            max-width: unset !important;
        }

        .account-selector-shown .blur-target {
            filter: blur(10px);
        }

        .account-selector-shown .page-footer {
            filter: blur(25px);
        }
    }
</style>
