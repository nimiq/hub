<template>
    <div class="container">
        <SmallPage>

            <transition name="transition-fade">
                <StatusScreen v-if="loading" :title="$t('Updating your balances')" lightBlue key="loading"/>

                <div v-else-if="!accountInfo" class="create-cashlink-choose-sender" key="choose-sender">
                    <PageHeader>
                        {{ $t('Choose Sender') }}
                    </PageHeader>
                    <AccountSelector :wallets="processedWallets" :min-balance="request.value || 1" @account-selected="setSender" @login="login"/>
                </div>

                <div v-else class="create-cashlink" key="create" :class="{ blurred: optionsOpened || openedDetails !== Details.NONE }">
                    <transition name="transition-fade">
                        <SmallPage v-if="optionsOpened" class="overlay fee" key="fee">
                            <PageBody>
                                <h1 class="nq-h1">{{ $t('Transaction Fee') }}</h1>
                                <p class="nq-text">{{ $t('Fee for relaying the USDT transaction on Polygon network.') }}</p>
                                <div class="fee-display-amount">{{ formatUsdtAmount(mockFee) }} USDT</div>
                            </PageBody>
                            <PageFooter>
                                <button class="nq-button light-blue" @click="optionsOpened = false">{{ $t('Got it') }}</button>
                            </PageFooter>
                            <CloseButton class="top-right" @click="optionsOpened = false" />
                        </SmallPage>

                        <SmallPage v-if="openedDetails !== Details.NONE" class="overlay" key="details">
                            <div class="account-details">
                                <h2 class="nq-h2">{{ selectedPolygonLabel }}</h2>
                                <div class="detail-address">{{ selectedPolygonAddress }}</div>
                                <div class="detail-balance">{{ formatUsdtAmount(selectedPolygonBalance) }} USDT</div>
                            </div>
                            <CloseButton class="top-right" @click="openedDetails = Details.NONE" />
                        </SmallPage>
                    </transition>

                    <PageHeader :backArrow="!request.senderAddress" @back="reset">
                        <span>{{ $t('Create a Cashlink') }}</span>
                        <a href="javascript:void(0)" class="nq-blue options-button" @click="optionsOpened = true">
                            <SettingsIcon/>
                        </a>
                    </PageHeader>

                    <PageBody ref="createCashlinkTooltipTarget">
                        <div class="sender-and-recipient">
                            <Account layout="column"
                                class="sender"
                                :address="selectedPolygonAddress"
                                :label="selectedPolygonLabel"
                                @click.native="openedDetails = Details.SENDER"/>
                            <ArrowRightIcon class="nq-light-blue arrow"/>
                            <Account layout="column"
                                :label="$t('New Cashlink')"
                                :displayAsCashlink="true"/>
                        </div>
                        <hr/>
                        <AmountWithFee ref="amountWithFee"
                            :available-balance="availableBalance"
                            v-model="liveAmountAndFee"
                            :fiatAmount="null"
                            :fiatCurrency="request.fiatCurrency"
                            currency="usdt"
                            :currencyDecimals="6"
                        />
                        <div class="message-with-tooltip">
                            <LabelInput class="message" :placeholder="$t('Add a message...')" :vanishing="true" :maxBytes="255" v-model="message" />
                            <Tooltip ref="tooltip" :container="$refs.createCashlinkTooltipTarget" autoWidth>
                                {{ $t('This message will be stored in the Cashlink.') }}
                            </Tooltip>
                        </div>
                    </PageBody>

                    <PageFooter>
                        <button class="nq-button light-blue"
                            :disabled="liveAmountAndFee.amount === 0 || !liveAmountAndFee.isValid"
                            @click="sendTransaction">
                            {{ $t('Create Cashlink') }}
                        </button>
                    </PageFooter>
                </div>
            </transition>
        </SmallPage>

        <GlobalClose />
    </div>
</template>

<script lang="ts">
// TODO [USDT-CASHLINK]: This component uses MOCK implementations for UI development
// Replace mock data and functions with actual Polygon/wallet store integration

import { Component, Vue, Watch } from 'vue-property-decorator';
import { Getter, Mutation, State } from 'vuex-class';
import { Static } from '../lib/StaticStore';
import staticStore from '../lib/StaticStore';
import StatusScreen from '../components/StatusScreen.vue';
import GlobalClose from '../components/GlobalClose.vue';
import { ParsedCreateCashlinkRequest } from '../lib/RequestTypes';
import { RequestType } from '../../client/PublicRequestTypes';
import UsdtCashlink from '../lib/UsdtCashlink';
import { AccountInfo } from '../lib/AccountInfo';
import { WalletInfo } from '../lib/WalletInfo';
import {
    mockSignUsdtCashlink,
    mockEstimateUsdtFee,
    mockGetUsdtBalance,
} from '../lib/polygon/MockPolygonHelpers';
import {
    Account,
    AccountDetails,
    AccountSelector,
    AmountWithFee,
    ArrowRightIcon,
    CloseButton,
    LabelInput,
    PageBody,
    PageFooter,
    PageHeader,
    SettingsIcon,
    SmallPage,
    Tooltip,
} from '@nimiq/vue-components';

@Component({components: {
    Account,
    AccountDetails,
    AccountSelector,
    AmountWithFee,
    ArrowRightIcon,
    CloseButton,
    GlobalClose,
    LabelInput,
    PageBody,
    PageFooter,
    PageHeader,
    SettingsIcon,
    SmallPage,
    StatusScreen,
    Tooltip,
}})
class UsdtCashlinkCreate extends Vue {
    public $refs!: {
        createCashlinkTooltipTarget: PageBody,
        amountWithFee: AmountWithFee,
    };

    @Static private request!: ParsedCreateCashlinkRequest;

    @State private wallets!: WalletInfo[];
    @Getter private processedWallets!: WalletInfo[];
    @Getter private findWalletByAddress!: (address: string, includeContracts: boolean) => WalletInfo | undefined;
    @Getter private findWallet!: (id: string) => WalletInfo | undefined;
    @Getter private activeAccount?: AccountInfo;

    @Mutation('addWallet') private $addWallet!: (walletInfo: WalletInfo) => any;
    @Mutation('setActiveAccount') private $setActiveAccount!: (payload: {
        walletId: string,
        userFriendlyAddress: string,
    }) => any;

    // TODO [USDT-CASHLINK]: Replace mock balance with actual USDT balance from Polygon network
    private selectedPolygonAddress: string | null = null;
    private selectedPolygonLabel: string = '';
    private selectedPolygonBalance: number = 0;
    private accountInfo: AccountInfo | null = null;

    private loading: boolean = false;
    private liveAmountAndFee: {amount: number, fee: number, isValid: boolean} = {
        amount: 0,
        fee: 0,
        isValid: false,
    };
    private mockFee: number = 500000; // 0.50 USDT in cents
    private message = '';
    private optionsOpened = false;
    private openedDetails = UsdtCashlinkCreate.Details.NONE;

    // Expose Details enum to template
    private get Details() {
        return UsdtCashlinkCreate.Details;
    }

    private get availableBalance(): number {
        return this.selectedPolygonBalance;
    }

    public async created() {
        // If there are no existing accounts, redirect to Onboarding
        if (this.wallets.length === 0) {
            this.login(true);
            return;
        }

        // If there is no wallet to the address provided in the request, remove it to let the user choose another
        if (this.request.senderAddress
            && !this.findWalletByAddress(this.request.senderAddress.toUserFriendlyAddress(), false)) {
            this.request.senderAddress = undefined;
        }

        if (this.request.value) {
            this.liveAmountAndFee.amount = this.request.value;
        }

        if (this.request.message) {
            this.message = this.request.message;
        }

        // Fetch mock fee
        try {
            this.mockFee = await mockEstimateUsdtFee();
        } catch (e) {
            console.error('Error estimating fee:', e);
        }

        this.liveAmountAndFee.fee = this.mockFee;

        this.loading = !staticStore.usdtCashlink && !this.request.senderAddress;

        // If there's a cashlink in static store (returning from keyguard), restore it
        if (staticStore.usdtCashlink) {
            this.liveAmountAndFee.amount = staticStore.usdtCashlink.value;
            this.liveAmountAndFee.fee = staticStore.usdtCashlink.fee;
            this.message = staticStore.usdtCashlink.message;

            // Restore sender from active account
            if (this.$store.state.activeUserFriendlyAddress) {
                await this.setSender(this.$store.state.activeWalletId, this.$store.state.activeUserFriendlyAddress);
            }
        } else if (this.request.senderAddress) {
            // Use the sender address provided in the request
            await this.setSender(null, this.request.senderAddress.toUserFriendlyAddress());
        }

        this.loading = false;
    }

    private async setSender(walletId: string | null, address: string) {
        const wallet = walletId
            ? this.findWallet(walletId)
            : this.findWalletByAddress(address, false);
        if (!wallet) {
            const errorMsg = walletId ? 'UNEXPECTED: WalletId not found!' : 'Address not found';
            this.$rpc.reject(new Error(errorMsg));
            return;
        }

        this.accountInfo = wallet.accounts.get(address) || null;
        if (!this.accountInfo) {
            this.$rpc.reject(new Error('Account not found'));
            return;
        }

        // TODO [USDT-CASHLINK]: Get actual Polygon address from wallet
        // For now, use wallet's first polygon address or fallback to mock
        if (wallet.polygonAddresses && wallet.polygonAddresses.length > 0) {
            this.selectedPolygonAddress = wallet.polygonAddresses[0].address;
        } else {
            // Fallback to mock address if wallet doesn't have polygon addresses yet
            this.selectedPolygonAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
        }
        this.selectedPolygonLabel = this.accountInfo.label;

        // TODO [USDT-CASHLINK]: Fetch actual USDT balance from Polygon network
        // For now, use mock balance
        this.selectedPolygonBalance = await mockGetUsdtBalance(this.selectedPolygonAddress!);

        this.$setActiveAccount({
            walletId: wallet.id,
            userFriendlyAddress: address,
        });
    }

    private login(useReplace = false) {
        staticStore.originalRouteName = RequestType.CREATE_CASHLINK;
        if (useReplace) {
            this.$router.replace({name: RequestType.ONBOARD});
        } else {
            this.$router.push({name: RequestType.ONBOARD});
        }
    }

    private formatUsdtAmount(cents: number): string {
        return (cents / 1000000).toFixed(2);
    }

    private async sendTransaction() {
        // TODO [USDT-CASHLINK]: Replace with actual keyguard signing
        // Expected: Call KeyguardClient.signUsdtCashlink(request)
        // Return: SignedPolygonTransaction

        if (!this.liveAmountAndFee.isValid || this.liveAmountAndFee.amount === 0) {
            return;
        }

        this.loading = true;

        try {
            const usdtCashlink = UsdtCashlink.create();
            staticStore.usdtCashlink = usdtCashlink;

            usdtCashlink.value = this.liveAmountAndFee.amount;
            usdtCashlink.fee = this.mockFee;
            usdtCashlink.message = this.message;
            if (this.request.theme) {
                usdtCashlink.theme = this.request.theme;
            }

            console.log('[MOCK] Created USDT Cashlink:', usdtCashlink.toObject());

            // Mock signing
            await mockSignUsdtCashlink({
                keyId: this.selectedPolygonAddress!,
                keyPath: 'm/44\'/60\'/0\'/0/0',
                keyLabel: this.selectedPolygonLabel,
                senderLabel: this.selectedPolygonLabel,
                cashlinkMessage: this.message,
                amount: usdtCashlink.value,
                fee: usdtCashlink.fee,
                recipient: usdtCashlink.address,
            });

            // Navigate to manage view
            this.$router.push({ name: RequestType.MANAGE_CASHLINK });
        } catch (error) {
            console.error('Error creating USDT Cashlink:', error);
            this.$rpc.reject(error as Error);
        } finally {
            this.loading = false;
        }
    }

    private reset() {
        this.liveAmountAndFee.isValid = false;
        this.accountInfo = null;
        this.selectedPolygonAddress = null;
        this.selectedPolygonLabel = '';
        this.selectedPolygonBalance = 0;
    }

    @Watch('accountInfo')
    @Watch('openedDetails')
    @Watch('optionsOpened')
    private focus(newValue: AccountInfo | null | UsdtCashlinkCreate.Details | boolean) {
        if ((typeof newValue === 'boolean' && newValue === false)
            || (typeof newValue === 'number' && newValue === UsdtCashlinkCreate.Details.NONE)
            || (typeof newValue === 'object' && newValue !== null)) {
            Vue.nextTick(() => this.$refs.amountWithFee!.focus());
        }
    }
}

namespace UsdtCashlinkCreate {
    export enum Details {
        NONE,
        SENDER,
        RECIPIENT,
    }
}

export default UsdtCashlinkCreate;
</script>

<style scoped>
    /* Copied from CashlinkCreate.vue with minimal changes */

    .container > .small-page {
        position: relative;
        overflow: hidden;
    }

    .status-screen {
        position: absolute;
        transition: opacity .3s var(--nimiq-ease);
    }

    .create-cashlink,
    .create-cashlink-choose-sender {
        position: absolute;
        width: 100%;
        height: 100%;
        transition: opacity .3s;
        display: flex;
        flex-direction: column;
    }

    /* Mock account selector styles - mimics AccountSelector component */
    .mock-account-selector {
        padding: 2rem;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        overflow-y: auto;
    }

    .mock-account-item {
        display: flex;
        align-items: center;
        padding: 2rem;
        background: white;
        border-radius: 0.5rem;
        box-shadow: 0 0.5rem 2rem rgba(0, 0, 0, 0.07);
        cursor: pointer;
        transition: transform 0.2s var(--nimiq-ease), box-shadow 0.2s var(--nimiq-ease);
    }

    .mock-account-item:hover {
        transform: translateY(-0.25rem);
        box-shadow: 0 1rem 2.5rem rgba(0, 0, 0, 0.1);
    }

    .mock-account-identicon {
        font-size: 4rem;
        margin-right: 2rem;
    }

    .mock-account-label {
        flex-grow: 1;
        font-size: 2.25rem;
        font-weight: 600;
    }

    .mock-account-balance {
        font-size: 2rem;
        font-weight: bold;
        color: var(--nimiq-green);
    }

    .page-footer .nq-button {
        margin-top: 0;
    }

    .create-cashlink .page-body {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-around;
        padding-bottom: 2rem;
        padding-top: 0;
    }

    .create-cashlink .page-body > .nq-label {
        margin-top: 6rem;
        margin-bottom: 3rem;
    }

    .sender-and-recipient {
        display: flex;
        align-items: center;
        width: 100%;
    }

    .sender-and-recipient .arrow {
        font-size: 3rem;
        margin-top: -6.5rem;
        transition: opacity .3s var(--nimiq-ease);
    }

    .options-button {
        position: absolute;
        top: 4rem;
        right: 4rem;
        opacity: .25;
        font-size: 3.625rem;
        transition: opacity .3s var(--nimiq-ease);
    }

    .options-button:hover {
        opacity: 1;
    }

    .sender-and-recipient .account {
        width: calc(50% - 1.1235rem);
    }

    .sender-and-recipient .account.sender {
        cursor: pointer;
    }

    .sender-and-recipient .account >>> .identicon {
        width: 9rem;
        height: 9rem;
    }

    .sender-and-recipient .account >>> .label {
        height: 3em;
    }

    .create-cashlink .value {
        display: flex;
        align-items: baseline;
        height: 14.5rem;
        border-top: .125rem solid var(--nimiq-highlight-bg);
        margin-top: 1rem;
        padding-top: 2rem;
    }

    .create-cashlink .message-with-tooltip {
        display: flex;
        align-items: center;
        max-width: 100%;
    }

    .page-body >>> .tooltip-box {
        font-size: 1.75rem;
        font-weight: 600;
        line-height: 1.49;
    }

    .create-cashlink .tooltip {
        font-size: 3rem;
        margin: 1rem 1rem 0;
    }

    .create-cashlink .tooltip >>> a.top::after {
        bottom: calc(1em + 0.75rem);
    }

    .create-cashlink .tooltip:not(.active) >>> a svg {
        color: rgba(31, 35, 72, 0.25) !important;
    }

    .create-cashlink .message {
        margin-top: 1rem;
        flex-grow: 1;
    }

    .overlay {
        position: absolute;
        z-index: 2;
        left: 0;
        top: 0;
        margin: 0;
        box-shadow: 0 0;
        background: rgba(255, 255, 255, .5);
        transition: opacity .3s var(--nimiq-ease);
    }

    .overlay .account-details {
        background: white;
        border-radius: 0.5rem;
        padding: 3rem;
        margin: 4rem;
        max-width: 40rem;
    }

    .overlay.fee .page-body {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
    }

    .fee-display-amount {
        font-size: 4rem;
        font-weight: bold;
        color: var(--nimiq-green);
        margin-top: 2rem;
    }

    .overlay.fee h1 {
        text-align: center;
    }

    .overlay.fee p {
        text-align: center;
        margin-bottom: 4rem;
        margin-top: .5rem;
    }

    .label-input {
        flex-grow: 1;
    }

    .create-cashlink > .page-body hr {
        width: 100%;
        margin: 0;
        height: 0.125rem;
        border: none;
        background-color: var(--nimiq-highlight-bg);
        transition: opacity .3s var(--nimiq-ease);
    }

    .amount-with-fee {
        flex-grow: 1;
        margin-top: 2rem;
        justify-content: center;
    }

    .create-cashlink .page-header >>> h1 > span,
    .create-cashlink .page-body >>> .amount-with-fee input,
    .create-cashlink .page-body >>> .amount-with-fee .nim,
    .create-cashlink .page-body >>> .amount-with-fee .fee-section,
    .create-cashlink .page-body >>> .label,
    .create-cashlink .page-body >>> .identicon,
    .create-cashlink .page-body >>> .message-with-tooltip input,
    .create-cashlink .page-body >>> .tooltip,
    .create-cashlink .page-footer >>> button {
        transition: filter .3s var(--nimiq-ease), opacity .3s var(--nimiq-ease);
        filter: blur(0px);
        opacity: 1;
    }

    .create-cashlink .page-footer >>> button {
        transition: filter .3s var(--nimiq-ease), opacity .3s var(--nimiq-ease), transform .45s var(--nimiq-ease);
    }

    .create-cashlink.blurred > .page-body >>> .arrow,
    .create-cashlink.blurred > .page-body hr,
    .create-cashlink.blurred > .page-header >>> a ,
    .create-cashlink.blurred > .page-header >>> h1 > a {
        opacity: 0;
    }

    .create-cashlink.blurred > .page-body,
    .create-cashlink.blurred > .page-body >>> .account,
    .create-cashlink.blurred > .page-body >>> .label-input {
        overflow: visible;
    }

    .create-cashlink.blurred > .page-header >>> h1 > span,
    .create-cashlink.blurred > .page-body >>> .amount-with-fee input,
    .create-cashlink.blurred > .page-body >>> .amount-with-fee .nim,
    .create-cashlink.blurred > .page-body >>> .amount-with-fee .fee-section,
    .create-cashlink.blurred > .page-body >>> .label,
    .create-cashlink.blurred > .page-body >>> .identicon,
    .create-cashlink.blurred > .page-body >>> .message-with-tooltip input,
    .create-cashlink.blurred > .page-body >>> .tooltip,
    .create-cashlink.blurred > .page-footer >>> button {
        opacity: .5;
        filter: blur(20px);
    }

    .sender-and-recipient {
        display: flex;
        align-items: center;
        width: 100%;
    }

    .create-cashlink .cashlink >>> .label {
        opacity: .5;
        line-height: 1.5;
    }

    .detail-address {
        font-family: 'Fira Mono', monospace;
        font-size: 1.5rem;
        opacity: 0.6;
        margin: 1rem 0;
        word-break: break-all;
    }

    .detail-balance {
        font-size: 2.5rem;
        font-weight: bold;
        color: var(--nimiq-green);
        margin-top: 2rem;
    }
</style>
