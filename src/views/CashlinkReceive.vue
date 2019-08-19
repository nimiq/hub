<template>
    <div class="container pad-bottom">
        <SmallPage v-if="cashlink || statusState">
            <transition name="transition-fade">
                <StatusScreen v-if="statusState"
                    :state="statusState"
                    :title="statusTitle"
                    :status="statusStatus"
                    :message="statusMessage"
                    mainAction="Got it"
                    @main-action="redirectToSafe"
                />
            </transition>
            <div v-if="cashlink && hasWallets" class="card-content has-account" :class="{ 'account-selector-shown': !!shownAccountSelector }">
                <PageHeader class="blur-target">You received a Cashlink!</PageHeader>
                <PageBody>
                    <div class="accounts" :class="{'single-address': addressCount === 1}">
                        <div class="cashlink-account account blur-target">
                            <div class="cashlink-icon nq-blue-bg">
                                <!-- TODO Replace with nimiq-style cashlink icon when available -->
                                <img src='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="white" stroke-linecap="round" stroke-width="2.5px" stroke-linejoin="round"><path d="M40.25,23.25v-.5a6.5,6.5,0,0,0-6.5-6.5h-3.5a6.5,6.5,0,0,0-6.5,6.5v6.5a6.5,6.5,0,0,0,6.5,6.5h2"/><path class="cls-1" d="M23.75,40.75v.5a6.5,6.5,0,0,0,6.5,6.5h3.5a6.5,6.5,0,0,0,6.5-6.5v-6.5a6.5,6.5,0,0,0-6.5-6.5h-2"/><line class="cls-2" x1="32" y1="11.25" x2="32" y2="15.25"/><line class="cls-2" x1="32" y1="48.75" x2="32" y2="52.75"/></svg>'>
                            </div>
                            <div class="label">Cashlink</div>
                        </div>
                        <ArrowRightIcon class="arrow-right blur-target"/>
                        <div v-if="addressCount > 1" class="recipient-button blur-target">
                            <button class="nq-button-s" @click="selectRecipient">Change</button>
                            <Account layout="column"
                                :address="activeAccount.userFriendlyAddress"
                                :label="activeAccount.label"
                                @click.native="selectRecipient"/>
                        </div>
                        <Account v-else layout="column"
                            :address="activeAccount.userFriendlyAddress"
                            :label="activeAccount.label"/>
                    </div>

                    <hr class="blur-target">

                    <div>
                        <Amount class="value nq-light-blue blur-target"
                            :amount="cashlink.value" :minDecimals="0" :maxDecimals="5" />

                        <div v-if="cashlink.message" class="data nq-text blur-target">
                            {{ cashlink.message }}
                        </div>
                    </div>
                    <div><!-- bottom flex spacer --></div>
                </PageBody>
                <PageFooter>
                    <button
                        class="nq-button light-blue"
                        :disabled="!canCashlinkBeClaimed"
                        @click="claim"
                    ><CircleSpinner v-if="isButtonLoading"/>{{ buttonText }}</button>
                </PageFooter>

                <transition name="transition-fade">
                    <div class="overlay" v-if="shownAccountSelector">
                        <button class="nq-button-s close" @click="shownAccountSelector = false"><CloseIcon/></button>
                        <PageHeader>Choose an Address</PageHeader>
                        <AccountSelector
                            :wallets="processedWallets"
                            :disableContracts="true"
                            @account-selected="accountSelected"
                            @login="goToLogin"
                        />
                    </div>
                </transition>
            </div>
            <div v-if="cashlink && !hasWallets" class="card-content no-account">
                <div class="top-spacer"><!-- top flex spacer --></div>

                <CashlinkSparkle/>

                <div>
                    <Amount class="value nq-light-blue blur-target"
                        :amount="cashlink.value" :minDecimals="0" :maxDecimals="5" />

                    <div v-if="cashlink.message" class="data nq-text blur-target">
                        {{ cashlink.message }}
                    </div>
                </div>

                <PageFooter>
                    <button class="nq-button light-blue" @click="goToSignup">Create Account</button>
                    <a class="nq-link skip" href="javascript:void(0)" @click="goToOnboarding">
                        Login to existing Account
                        <CaretRightSmallIcon/>
                    </a>
                </PageFooter>
            </div>
        </SmallPage>

        <div v-if="cashlink && !hasWallets" class="welcome-text">
            <h1 class="nq-h1">Claim your Cash</h1>
            <p class="nq-text">
                <span class="main-text">Congrats, you just opened a Nimiq Cashlink. Create an Account and claim your money.</span>
                30&nbsp;seconds, no&nbsp;email, no&nbsp;download.
            </p>
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
    CloseIcon,
    Account,
    Amount,
    AccountSelector,
} from '@nimiq/vue-components';
import StatusScreen from '../components/StatusScreen.vue';
import CashlinkSparkle from '../components/CashlinkSparkle.vue';
import CircleSpinner from '../components/CircleSpinner.vue';
import Cashlink from '../lib/Cashlink';
import { CashlinkState, BasicRequest } from '../lib/PublicRequestTypes';
import { AccountInfo } from '../lib/AccountInfo';
import { Getter, Mutation } from 'vuex-class';
import { NetworkClient, DetailedPlainTransaction } from '@nimiq/network-client';
import Config from 'config';
import { WalletInfo } from '../lib/WalletInfo';
import { NETWORK_MAIN } from '../lib/Constants';
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
    CloseIcon,
    Account,
    Amount,
    AccountSelector,
}})
export default class CashlinkReceive extends Vue {
    @Getter private addressCount!: number;
    @Getter private hasWallets!: boolean;
    @Getter private activeAccount?: AccountInfo;
    @Getter private processedWallets!: WalletInfo[];

    @Mutation('setActiveAccount') private $setActiveAccount!:
        (payload: {walletId: string, userFriendlyAddress: string}) => any;

    private cashlink: Cashlink | null = null;
    private selectedAddress: AccountInfo | null = null;
    private consensus: string | null = null;
    private shownAccountSelector: boolean = false;
    private isClaiming: boolean = false;

    private statusState: StatusScreen.State | false = false;
    private statusTitle = 'Initializing Cashlink';
    private statusStatus = 'Parsing your link...';
    private statusMessage = '';

    public created() {
        function handler(result: any, storedData: {url: string}) {
            if (storedData.url) window.history.replaceState(window.history.state, '', storedData.url);
        }

        const hubApi = new HubApi();
        hubApi.on(HubApi.RequestType.SIGNUP, handler, handler);
        hubApi.on(HubApi.RequestType.LOGIN, handler, handler);
        hubApi.on(HubApi.RequestType.ONBOARD, handler, handler);
        hubApi.checkRedirectResponse();
    }

    public async mounted() {
        // Load cashlink from URL
        this.cashlink = await Cashlink.parse(window.location.hash.substring(1));

        // Fail if no cashlink found
        if (!this.cashlink) {
            this.statusState = StatusScreen.State.WARNING;
            this.statusTitle = '404 - Cash not found';
            this.statusMessage = 'This is not a valid cashlink, sorry.';
            return;
        }

        // Hide loading screen
        this.statusState = false;

        if (this.hasWallets) {
            // 4. Start network to check chashlink status
            if (!NetworkClient.hasInstance()) {
                NetworkClient.createInstance(Config.networkEndpoint);
            }
            await NetworkClient.Instance.init();

            // Set up consensus listeners
            NetworkClient.Instance.on(NetworkClient.Events.CONSENSUS_SYNCING, () => this.consensus = 'syncing');
            NetworkClient.Instance.on(NetworkClient.Events.CONSENSUS_ESTABLISHED, () => this.consensus = 'established');
            NetworkClient.Instance.on(NetworkClient.Events.CONSENSUS_LOST, () => this.consensus = 'lost');
            this.consensus = NetworkClient.Instance.consensusState;

            this.cashlink.networkClient = NetworkClient.Instance;
        }
    }

    private async claim() {
        // Start loading screen
        this.statusState = StatusScreen.State.LOADING;
        this.statusTitle = 'Claiming Cashlink';
        this.statusStatus = 'Connecting to Nimiq...';

        this.isClaiming = true;

        this.cashlink!.claim(this.activeAccount!.userFriendlyAddress);

        // Set up transaction-relayed listener, so we know when the tx has been sent
        try {
            await new Promise((resolve, reject) => {
                NetworkClient.Instance.on(NetworkClient.Events.TRANSACTION_RELAYED, (tx: DetailedPlainTransaction) => {
                    if (tx.sender === this.cashlink!.address.toUserFriendlyAddress()) resolve();
                    // window.setTimeout(reject, 10 * 1000); // 10 seconds timeout
                });
            });

            await CashlinkStore.Instance.put(this.cashlink!);

            // Show success screen and redirect to Safe
            this.statusState = StatusScreen.State.SUCCESS;
            this.statusTitle = 'Cashlink claimed!';

            window.setTimeout(() => this.redirectToSafe(), StatusScreen.SUCCESS_REDIRECT_DELAY);
        } catch (err) {
            // Return to regular screen
            this.statusState = false;
        }
    }

    private selectRecipient() {
        this.shownAccountSelector = true;
    }

    private accountSelected(walletId: string, userFriendlyAddress: string) {
        this.$setActiveAccount({ walletId, userFriendlyAddress });
        this.shownAccountSelector = false;
    }

    private goToSignup() {
        this.callHub('signup');
    }

    private goToLogin() {
        this.callHub('login');
    }

    private goToOnboarding() {
        this.callHub('onboard');
    }

    private callHub(method: string) {
        const request: BasicRequest = {
            appName: 'Cashlink',
        };

        const redirectBehavior = new HubApi.RedirectRequestBehavior(undefined, { url: window.location.href });
        const hubApi = new HubApi(undefined, redirectBehavior);

        switch (method) {
            case 'signup': hubApi.signup(request); break;
            case 'login': hubApi.login(request); break;
            case 'onboard': hubApi.onboard(request); break;
        }
    }

    private redirectToSafe() {
        window.location.href = Config.network === NETWORK_MAIN
            ? 'https://safe.nimiq.com'
            : 'https://safe.nimiq-testnet.com';
    }

    private get isCashlinkStateKnown(): boolean {
        if (!this.consensus) return false;
        return this.cashlink!.state !== CashlinkState.UNKNOWN;
    }

    private get canCashlinkBeClaimed(): boolean {
        if (!this.consensus) return false;
        return this.cashlink!.state === CashlinkState.UNCLAIMED;
    }

    private get buttonText(): string {
        if (!this.isCashlinkStateKnown) return 'Checking status';
        else if (this.canCashlinkBeClaimed) return 'Claim cashlink';
        else if (this.cashlink!.state === CashlinkState.UNCHARGED) return 'Cashlink not funded';
        else if (this.cashlink!.state === CashlinkState.CHARGING) return 'Cashlink funding';
        else {
            if (!this.isClaiming) {
                this.statusState = StatusScreen.State.WARNING;
                this.statusTitle = 'Cashlink is empty';
                this.statusMessage = 'This cashlink has already been claimed.';
            }
            return 'Cashlink empty :(';
        }
    }

    private get isButtonLoading(): boolean {
        return !this.isCashlinkStateKnown || this.cashlink!.state === CashlinkState.CHARGING;
    }

    private get isCashlinkAlreadyClaimed(): boolean {
        return this.cashlink!.state >= CashlinkState.CLAIMING;
    }
}
</script>

<style scoped>
    .container {
        flex-direction: row !important;
        padding: 0 5rem; /* Side padding for smaller screens */
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

    .welcome-text {
        max-width: 514px;
        margin-left: 8.75rem; /* nq-card already has 1.25rem margin */
        transition: opacity .8s, transform .8s;
    }

    .welcome-text .nq-h1 {
        font-size: 8rem;
        margin-top: 0;
        margin-bottom: 4rem;
    }

    .welcome-text .nq-text {
        font-size: 4rem;
        color: rgba(31, 35, 72, 0.5);
    }

    .welcome-text .main-text {
        color: var(--nimiq-blue);
    }

    .transition-welcome-text-enter,
    .transition-welcome-text-leave-to {
        opacity: 0;
        transform: translate3d(-6rem, 0, 0);
    }

    .small-page {
        position: relative;
        overflow: hidden; /* avoid overflow of blurred elements */
        transition: opacity .8s;
    }

    .page-header {
        padding: 0;
        margin: 4rem; /* use margin instead of padding to reduce area on which to apply expensive blur */
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
        display: flex;
        flex-direction: column;
        align-items: center;
        margin-top: 5.125rem;
    }

    .cashlink-account,
    .recipient-button {
        width: calc(50% - 1.5rem - 2.75rem); /* minus half arrow width */
        padding: 0;
    }

    .recipient-button .account {
        cursor: pointer;
    }

    .cashlink-icon {
        width: 8rem;
        height: 8rem;
        border-radius: 4rem;
        margin: 0.5rem;
        margin-bottom: 1.75rem; /* 1.25rem like the Identicon, + 0.5rem from own margin */
    }

    .recipient-button .account >>> .identicon {
        height: 9rem;
    }

    .cashlink-label {
        line-height: 1.5;
    }

    .accounts .arrow-right {
        font-size: 3rem;
        margin: 8.125rem 2.75rem 3rem;
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
        height: 2.75rem;
        line-height: 2.75rem;
        padding: 0 1.125rem;
    }

    .recipient-button .account {
        padding-left: 0;
        padding-right: 0;
    }

    .accounts.single-address .cashlink-account {
        margin: 2rem 1.5rem 0;
    }

    .accounts.single-address .arrow-right {
        margin-top: 5.125rem;
        margin-right: -1rem;
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
    }

    .no-account .value {
        font-size: 8rem;
    }

    .value >>> .nim {
        margin-left: -.25rem;
        font-size: 0.45em;
        font-weight: 700;
    }

    .data {
        margin: 0.5rem 0 0;
        font-size: 2.5rem;
        color: var(--nimiq-blue);
        text-align: center;
        max-height: 9.75rem; /* three lines */
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
        transition: opacity .3s cubic-bezier(0.25, 0, 0, 1);
    }

    .skip .nq-icon  {
        height: 1.125rem;
        width: 1.125rem;
        transition: transform .3s cubic-bezier(0.25, 0, 0, 1);
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
    }

    .overlay {
        position: absolute;
        top: 0;
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        transition: opacity .4s;
        background: rgba(255, 255, 255, .875); /* equivalent to keyguard: .5 on blurred and .75 on account details */
    }

    .overlay .close {
        position: absolute;
        right: 2rem;
        top: 2rem;
        font-size: 3rem;
        padding: 0;
        height: 3rem;
        background: none;
    }

    .overlay .close .nq-icon {
        opacity: 0.2;
        transition: opacity .25s;
    }

    .overlay .close:hover .nq-icon,
    .overlay .close:focus .nq-icon {
        opacity: 0.4;
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
            flex-grow: 1;
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

        .transition-welcome-text-enter,
        .transition-welcome-text-leave-to {
            transform: translate3d(0, 3rem, 0);
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
    }
</style>
