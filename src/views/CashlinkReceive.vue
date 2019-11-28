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
            <div v-if="cashlink && hasWallets" class="card-content has-account" :class="{ 'account-selector-shown': !!isAccountSelectorOpened }">
                <PageHeader class="blur-target">You received a Cashlink!</PageHeader>
                <PageBody>
                    <div class="accounts" :class="{'single-address': addressCount === 1}">
                        <Account class="cashlink-account blur-target" layout="column"
                            :displayAsCashlink="true"
                            label="Cashlink"/>
                        <ArrowRightIcon class="arrow-right blur-target"/>
                        <div v-if="addressCount > 1" class="recipient-button blur-target">
                            <button class="nq-button-s" @click="isAccountSelectorOpened = true;">Change</button>
                            <Account layout="column"
                                :address="activeAccount.userFriendlyAddress"
                                :label="activeAccount.label"/>
                        </div>
                        <Account v-else layout="column"
                            :address="activeAccount.userFriendlyAddress"
                            :label="activeAccount.label"/>
                    </div>

                    <hr class="blur-target"/>

                    <div>
                        <Amount class="value nq-light-blue blur-target"
                            :amount="cashlink.value"
                            :minDecimals="0"
                            :maxDecimals="5"/>

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
                    <div v-if="isAccountSelectorOpened" class="overlay">
                        <CloseButton class="top-right" @click="isAccountSelectorOpened = false" />
                        <PageHeader>Choose an Address</PageHeader>
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
                    <Amount class="value nq-light-blue blur-target"
                        :amount="cashlink.value" :minDecimals="0" :maxDecimals="5" />

                    <div v-if="cashlink.message" class="data nq-text blur-target">
                        {{ cashlink.message }}
                    </div>
                </div>

                <PageFooter>
                    <button class="nq-button light-blue" @click="callHub('signup')">Create Account</button>
                    <a class="nq-link skip" href="javascript:void(0)" @click="callHub('onboard')">
                        Login to existing Account
                        <CaretRightSmallIcon/>
                    </a>
                </PageFooter>
            </div>
        </SmallPage>

        <div v-if="cashlink && !hasWallets" class="welcome-text">
            <h1 class="nq-h1">Claim your Cash</h1>
            <p class="nq-text">
                Congrats, you just opened a Nimiq Cashlink. Create an Account and claim your money.
                <span class="secondary-text">30&nbsp;seconds, no&nbsp;email, no&nbsp;download.</span>
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
    CloseButton,
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
    CloseButton,
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
    private isAccountSelectorOpened: boolean = false;
    private isClaiming: boolean = false;

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
    }

    public async mounted() {
        // Load Cashlink from URL
        this.cashlink = await Cashlink.parse(window.location.hash.substring(1));

        // Fail if no Cashlink was found
        if (!this.cashlink) {
            this.statusState = StatusScreen.State.WARNING;
            this.statusTitle = '404 - Cash not found';
            this.statusMessage = 'This is not a valid Cashlink, sorry.';
            return;
        }

        // When user has no wallets, skip Cashlink init because user needs to signup/login first
        // which requires this page to be reloaded anyway.
        if (!this.hasWallets) return;

        // Start network to check Cashlink status
        if (!NetworkClient.hasInstance()) {
            NetworkClient.createInstance(Config.networkEndpoint);
        }
        await NetworkClient.Instance.init();

        // Assign network to Cashlink
        this.cashlink.networkClient = NetworkClient.Instance;
    }

    private async claim() {
        // Start loading screen
        this.statusState = StatusScreen.State.LOADING;
        this.statusTitle = 'Claiming Cashlink';
        this.statusStatus = 'Connecting to Nimiq...';

        this.isClaiming = true;

        this.cashlink!.claim(this.activeAccount!.userFriendlyAddress);

        // Set up transaction-relayed listener, so we know when the tx has been sent
        await new Promise((resolve, reject) => {
            NetworkClient.Instance.on(NetworkClient.Events.TRANSACTION_RELAYED, (tx: DetailedPlainTransaction) => {
                if (tx.sender === this.cashlink!.address.toUserFriendlyAddress()) resolve();
            });
        });

        try {
            await CashlinkStore.Instance.put(this.cashlink!);
        } catch (err) {
            // Ignore, because cashlink has been claimed sucessfully and will show up in the Safe
        }

        // Show success screen and redirect to Safe
        this.statusState = StatusScreen.State.SUCCESS;
        this.statusTitle = 'Cashlink claimed!';

        window.setTimeout(() => this.redirectToSafe(), StatusScreen.SUCCESS_REDIRECT_DELAY);
    }

    private accountSelected(walletId: string, userFriendlyAddress: string) {
        this.$setActiveAccount({ walletId, userFriendlyAddress });
        this.isAccountSelectorOpened = false;
    }

    private callHub(method: 'signup' | 'login' | 'onboard') {
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
        return this.cashlink!.state !== CashlinkState.UNKNOWN;
    }

    private get canCashlinkBeClaimed(): boolean {
        return this.cashlink!.state === CashlinkState.UNCLAIMED;
    }

    private get buttonText(): string {
        if (!this.isCashlinkStateKnown) return 'Checking status';
        else if (this.canCashlinkBeClaimed) return 'Claim Cashlink';
        else if (this.cashlink!.state === CashlinkState.UNCHARGED) return 'Cashlink not funded';
        else if (this.cashlink!.state === CashlinkState.CHARGING) return 'Cashlink funding';
        else {
            if (!this.isClaiming) {
                this.statusState = StatusScreen.State.WARNING;
                this.statusTitle = 'Cashlink is empty';
                this.statusMessage = 'This Cashlink has already been claimed.';
            }
            return 'Cashlink empty :(';
        }
    }

    private get isButtonLoading(): boolean {
        return !this.isCashlinkStateKnown || this.cashlink!.state === CashlinkState.CHARGING;
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
        color: var(--nimiq-blue);
    }

    .welcome-text .secondary-text {
        color: rgba(31, 35, 72, 0.5);
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
        margin-top: 3rem;
    }

    .cashlink-account,
    .recipient-button {
        width: calc(50% - 1.5rem - 2.75rem); /* minus half arrow width */
    }

    .cashlink-icon {
        width: 8rem;
        height: 8rem;
        border-radius: 4rem;
        margin: 0.5rem;
        margin-bottom: 1.75rem; /* 1.25rem like the Identicon, + 0.5rem from own margin */
    }

    .cashlink-icon svg {
        width: 100%;
        height: 100%;
    }

    .recipient-button .account >>> .identicon {
        height: 9rem;
    }

    .cashlink-label {
        line-height: 1.5;
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
        transition: opacity .3s var(--nimiq-ease);
    }

    .skip .nq-icon  {
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
