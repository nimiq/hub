<template>
    <div class="container pad-bottom">
        <SmallPage :class="{ 'account-selector-shown': !!shownAccountSelector }">
            <StatusScreen v-if="!cashlink"
                :state="statusState"
                :title="statusTitle"
                :status="statusStatus"
                :message="statusMessage"
            />
            <div v-else-if="hasWallets" class="card-content has-account">
                <PageHeader class="blur-target">You received a Cashlink!</PageHeader>
                <PageBody>
                    <div class="accounts">
                        <div class="cashlink-account account blur-target">
                            <div class="cashlink-icon nq-blue-bg">
                                <img src='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="white" stroke-linecap="round" stroke-width="2.5px" stroke-linejoin="round"><path d="M40.25,23.25v-.5a6.5,6.5,0,0,0-6.5-6.5h-3.5a6.5,6.5,0,0,0-6.5,6.5v6.5a6.5,6.5,0,0,0,6.5,6.5h2"/><path class="cls-1" d="M23.75,40.75v.5a6.5,6.5,0,0,0,6.5,6.5h3.5a6.5,6.5,0,0,0,6.5-6.5v-6.5a6.5,6.5,0,0,0-6.5-6.5h-2"/><line class="cls-2" x1="32" y1="11.25" x2="32" y2="15.25"/><line class="cls-2" x1="32" y1="48.75" x2="32" y2="52.75"/></svg>'>
                            </div>
                            <div class="label">Cashlink</div>
                        </div>
                        <ArrowRightIcon class="arrow-right blur-target"/>
                        <Account layout="column"
                            :address="activeAccount.userFriendlyAddress"
                            :label="activeAccount.label"
                            @click.native="selectRecipient"
                            class="blur-target">
                        </Account>
                    </div>

                    <hr class="blur-target">

                    <div>
                        <Amount class="value nq-light-blue blur-target"
                            :amount="cashlink.value" :minDecimals="2" :maxDecimals="5" />

                        <div v-if="cashlink.message" class="data nq-text blur-target">
                            {{ cashlink.message }}
                        </div>
                    </div>
                    <div><!-- bottom flex spacer --></div>
                </PageBody>
                <PageFooter>
                    <button
                        class="nq-button"
                        :class="{'loading-spinner': isButtonLoading}"
                        :disabled="!canCashlinkBeClaimed"
                    >{{ buttonText }}</button>
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
            <div v-else class="card-content no-account">
                <div><!-- top flex spacer --></div>

                <CashlinkSparkle/>

                <div>
                    <Amount class="value nq-light-blue blur-target"
                        :amount="cashlink.value" :minDecimals="2" :maxDecimals="5" />

                    <div v-if="cashlink.message" class="data nq-text blur-target">
                        {{ cashlink.message }}
                    </div>
                </div>

                <PageFooter>
                    <button class="nq-button light-blue" @click="goToSignup">Create Account</button>
                    <a class="nq-link skip" href="javascript:void(0)" @click="goToLogin">
                        Log into existing Account
                        <CaretRightSmallIcon/>
                    </a>
                </PageFooter>
            </div>
        </SmallPage>
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
import Cashlink from '../lib/Cashlink';
import { CashlinkState } from '../lib/PublicRequestTypes';
import { AccountInfo } from '../lib/AccountInfo';
import { Getter, Mutation } from 'vuex-class';
import staticStore from '@/lib/StaticStore';
import { CASHLINK_RECEIVE } from '../router';
import { RequestType, ParsedBasicRequest } from '../lib/RequestTypes';
import { NetworkClient } from '@nimiq/network-client';
import Config from 'config';
import { WalletInfo } from '../lib/WalletInfo';

@Component({components: {
    SmallPage,
    StatusScreen,
    CashlinkSparkle,
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
    @Getter private hasWallets!: boolean;
    @Getter private activeAccount?: AccountInfo;
    @Getter private processedWallets!: WalletInfo[];

    @Mutation('setActiveAccount') private $setActiveAccount!:
        (payload: {walletId: string, userFriendlyAddress: string}) => any;

    private cashlink: Cashlink | null = null;
    private selectedAddress: AccountInfo | null = null;
    private network: NetworkClient | null = null;
    private shownAccountSelector: boolean = false;

    private statusState = StatusScreen.State.LOADING;
    private statusTitle = 'Initializing Cashlink';
    private statusStatus = 'Parsing your link...';
    private statusMessage = '';

    public async mounted() {
        // 1. Load cashlink from URL
        this.cashlink = await Cashlink.parse(window.location.hash.substring(1));

        if (this.cashlink) {
            // Write cashlink into static store
            staticStore.cashlink = this.cashlink;
        }

        // 2. If none in URL, try to load from static store
        if (!this.cashlink && staticStore.cashlink) {
            this.cashlink = staticStore.cashlink;
            // Write cashlink back into URL
            const url = new URL(window.location.href);
            url.hash = this.cashlink.render();
            window.history.replaceState(window.history.state, '', url.toString());
        }

        // 3. Fail if no cashlink found
        if (!this.cashlink) {
            this.statusState = StatusScreen.State.WARNING;
            this.statusTitle = '404 - Cash not found';
            this.statusMessage = 'This is not a valid cashlink, sorry.';
            return;
        }

        if (this.hasWallets) {
            // 4. Start network to check chashlink status
            this.network = NetworkClient.hasInstance()
                ? NetworkClient.Instance
                : NetworkClient.createInstance(Config.networkEndpoint);
            await this.network.init();
            this.cashlink.networkClient = this.network;
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
        this.goToOnboarding(RequestType.SIGNUP);
    }

    private goToLogin() {
        this.goToOnboarding(RequestType.ONBOARD);
    }

    private goToOnboarding(requestType: RequestType) {
        staticStore.originalRouteName = CASHLINK_RECEIVE;

        // Fake request
        const request: ParsedBasicRequest = {
            appName: 'Cashlink',
            kind: requestType,
        };
        staticStore.request = request;

        // Fake incomingRequest, so the routed-to component is rendered by App.vue
        this.$store.commit('setRequestLoaded', true);

        this.$rpc.routerPush(requestType);
    }

    private get isCashlinkStateKnown(): boolean {
        if (!this.network) return false;
        return this.network.consensusState === 'established'
            && this.cashlink!.state !== CashlinkState.UNKNOWN;
    }

    private get canCashlinkBeClaimed(): boolean {
        if (!this.network) return false;
        return this.cashlink!.state === CashlinkState.UNCLAIMED;
    }

    private get buttonText(): string {
        if (!this.isCashlinkStateKnown) return 'Checking status...';
        if (this.canCashlinkBeClaimed) return 'Claim cashlink';
        if (this.cashlink!.state === CashlinkState.UNCHARGED) return 'Cashlink not funded';
        if (this.cashlink!.state === CashlinkState.CHARGING) return 'Cashlink funding...';
        else return 'Cashlink empty :(';
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
    .card-content {
        display: flex;
        flex-direction: column;
        flex-grow: 1;
    }

    .card-content.no-account {
        align-items: center;
        justify-content: space-between;
    }

    .small-page {
        position: relative;
        overflow: hidden; /* avoid overflow of blurred elements */
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
        margin-top: .75rem;
    }

    .cashlink-account {
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .accounts .account {
        width: calc(50% - 1.5rem); /* minus half arrow width */
        padding: 0;
    }

    .accounts .account:not(.cashlink-account) {
        cursor: pointer;
    }

    .cashlink-icon {
        width: 8rem;
        height: 8rem;
        border-radius: 4rem;
        margin: 0.5rem;
        margin-bottom: 1.75rem; /* 1.25rem like the Identicon, + 0.5rem from own margin */
    }

    .accounts .account >>> .identicon {
        height: 9rem;
        transition: transform 0.45s ease;
    }

    .accounts .account:hover >>> .identicon {
        transform: scale(1.1);
    }

    .cashlink-label {
        line-height: 1.5;
    }

    .accounts .arrow-right {
        font-size: 3rem;
        margin-top: 3rem;
        color: var(--nimiq-light-blue);
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
        margin: 0.5rem 3rem 0;
        font-size: 2.5rem;
        color: var(--nimiq-blue);
        text-align: center;
        max-height: 9.75rem; /* three lines */
    }

    .no-account .data {
        margin-top: 1rem;
    }

    button.loading-spinner::before {
        content: 'O';
        margin-right: 1rem;
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

    .blur-target {
        transition: filter .4s;
    }

    .account-selector-shown .blur-target {
        filter: blur(20px);
    }
    .account-selector-shown .page-footer {
        filter: blur(35px);
    }
</style>