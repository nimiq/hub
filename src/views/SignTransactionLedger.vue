<template>
    <div class="container">
        <SmallPage :class="{ 'account-details-shown': !!shownAccountDetails }">
            <PaymentInfoLine
                v-if="request.kind === 'checkout'"
                ref="info"
                class="blur-target"
                :cryptoAmount="{
                    amount: checkoutPaymentOptions.amount + checkoutPaymentOptions.protocolSpecific.fee,
                    currency: checkoutPaymentOptions.currency,
                    decimals: checkoutPaymentOptions.decimals,
                }"
                :fiatAmount="request.fiatAmount && request.fiatCurrency ? {
                    amount: request.fiatAmount,
                    currency: request.fiatCurrency,
                } : null"
                :address="checkoutPaymentOptions.protocolSpecific.recipient
                    ? checkoutPaymentOptions.protocolSpecific.recipient.toUserFriendlyAddress()
                    : null"
                :origin="rpcState.origin"
                :shopLogoUrl="request.shopLogoUrl"
                :startTime="request.time"
                :endTime="checkoutPaymentOptions.expires"
            />
            <PageHeader :back-arrow="request.kind === 'checkout'" @back="_back" class="blur-target">
                {{ request.kind === 'checkout' ? 'Verify Payment' : 'Confirm Transaction' }}
            </PageHeader>

            <div class="accounts">
                <Account layout="column"
                    :address="senderDetails.address"
                    :label="senderDetails.label"
                    @click.native="shownAccountDetails = senderDetails"
                    class="blur-target">
                </Account>
                <ArrowRightIcon class="arrow-right blur-target"/>
                <Account layout="column"
                    :address="recipientDetails.address"
                    :label="recipientDetails.label"
                    :image="recipientDetails.image"
                    @click.native="shownAccountDetails = recipientDetails"
                    class="blur-target">
                </Account>
            </div>

            <hr class="blur-target">

            <Amount class="value nq-light-blue blur-target"
                :amount="checkoutPaymentOptions ? checkoutPaymentOptions.amount : request.value"
                :minDecimals="2"
                :maxDecimals="5"
            />

            <div v-if="checkoutPaymentOptions ? checkoutPaymentOptions.protocolSpecific.fee : request.fee"
                class="fee nq-text-s blur-target">
                + <Amount
                    :amount="checkoutPaymentOptions ? checkoutPaymentOptions.protocolSpecific.fee : request.fee"
                    :minDecimals="2" :maxDecimals="5"
                /> fee
            </div>

            <div v-if="transactionData" class="data nq-text blur-target">
                {{ transactionData }}
            </div>

            <div class="bottom-container blur-target" :class="{ 'full-height': state !== constructor.State.OVERVIEW }">
                <LedgerUi ref="ledger-ui" small></LedgerUi>
                <transition name="transition-fade">
                    <StatusScreen v-if="state !== constructor.State.OVERVIEW"
                        :state="statusScreenState"
                        :title="statusScreenTitle"
                        :mainAction="state === constructor.State.EXPIRED ? 'Go back to shop' : null"
                        @main-action="_close"
                    >
                        <template v-if="state === constructor.State.EXPIRED" v-slot:warning>
                            <StopwatchIcon class="stopwatch-icon"/>
                            <h1 class="title nq-h1">{{ statusScreenTitle }}</h1>
                            <p class="message nq-text">Please go back to the shop and restart the process.</p>
                        </template>
                    </StatusScreen>
                </transition>
            </div>

            <transition name="transition-fade">
                <AccountDetails v-if="shownAccountDetails"
                    :address="shownAccountDetails.address"
                    :image="shownAccountDetails.image"
                    :label="shownAccountDetails.label"
                    :walletLabel="shownAccountDetails.walletLabel"
                    :balance="shownAccountDetails.balance"
                    @close="shownAccountDetails = null">
                </AccountDetails>
            </transition>
        </SmallPage>

        <button class="global-close nq-button-s" @click="_close"
            :class="{ hidden: state !== constructor.State.OVERVIEW }">
            <ArrowLeftSmallIcon/>
            {{ request.kind === 'checkout' ? 'Cancel Payment' : `Back to ${request.appName}` }}
        </button>
        <Network ref="network" :visible="false"/>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Watch } from 'vue-property-decorator';
import {
    Account,
    AccountDetails,
    Amount,
    ArrowLeftSmallIcon,
    ArrowRightIcon,
    PageBody,
    PageHeader,
    PaymentInfoLine,
    SmallPage,
    StopwatchIcon,
} from '@nimiq/vue-components';
import Network from '../components/Network.vue';
import LedgerApi from '../lib/LedgerApi';
import LedgerUi from '../components/LedgerUi.vue';
import StatusScreen from '../components/StatusScreen.vue';
import { Static } from '../lib/StaticStore';
import { Getter } from 'vuex-class';
import { State as RpcState } from '@nimiq/rpc';
import { ParsedCheckoutRequest, ParsedSignTransactionRequest } from '../lib/RequestTypes';
import { Currency, RequestType } from '../lib/PublicRequestTypes';
import { WalletInfo } from '../lib/WalletInfo';
import { CASHLINK_FUNDING_DATA, ERROR_CANCELED, ERROR_REQUEST_TIMED_OUT, TX_VALIDITY_WINDOW } from '../lib/Constants';
import { ParsedNimiqDirectPaymentOptions } from '../lib/paymentOptions/NimiqPaymentOptions';
import { Utf8Tools } from '@nimiq/utils';
import Config from 'config';
import CheckoutServerApi from '../lib/CheckoutServerApi';

interface AccountDetailsData {
    address: string;
    label: string;
    image?: string;
    walletLabel?: string;
    balance?: number;
}

@Component({components: {
    Account,
    PageBody,
    PageHeader,
    PaymentInfoLine,
    SmallPage,
    LedgerUi,
    StatusScreen,
    AccountDetails,
    Network,
    Amount,
    ArrowLeftSmallIcon,
    ArrowRightIcon,
    StopwatchIcon,
}})
export default class SignTransactionLedger extends Vue {
    private static readonly State = {
        OVERVIEW: 'overview',
        SENDING_TRANSACTION: 'sending-transaction',
        FINISHED: 'finished',
        EXPIRED: 'expired',
    };

    @Static private rpcState!: RpcState;
    @Static private request!: ParsedSignTransactionRequest | ParsedCheckoutRequest;
    @Getter private findWalletByAddress!: (address: string, includeContracts: boolean) => WalletInfo | undefined;

    private state: string = SignTransactionLedger.State.OVERVIEW;
    private senderDetails: AccountDetailsData = { address: '', label: '' };
    private recipientDetails: AccountDetailsData = { address: '', label: ''};
    private shownAccountDetails: AccountDetailsData | null = null;
    private _checkoutExpiryTimeout: number = -1;

    private async mounted() {
        const network = this.$refs.network as Network;

        // collect payment information
        let sender: Nimiq.Address;
        let recipient: Nimiq.Address;
        let value: number;
        let fee: number;
        let validityStartHeightPromise: Promise<number>;
        let data: Uint8Array;
        let flags: number;
        if (this.request.kind === RequestType.SIGN_TRANSACTION) {
            // direct sign transaction request invocation
            const signTransactionRequest = this.request as ParsedSignTransactionRequest;
            ({ sender, recipient, value, fee, data, flags } = signTransactionRequest);
            validityStartHeightPromise = Promise.resolve(signTransactionRequest.validityStartHeight);

            const recipientUserFriendlyAddress = signTransactionRequest.recipient.toUserFriendlyAddress();
            this.recipientDetails = {
                address: recipientUserFriendlyAddress,
                label: recipientUserFriendlyAddress,
            };
        } else if (this.request.kind === RequestType.CHECKOUT) {
            // coming from checkout
            const checkoutRequest = this.request as ParsedCheckoutRequest;
            const $subtitle = document.querySelector('.logo .logo-subtitle')!;
            $subtitle.textContent = 'Checkout'; // reapply the checkout subtitle in case the page was reloaded
            document.title = 'Nimiq Checkout';

            // Update checkout payment options. This is typically instant even after reload as CheckoutServerApi caches
            // the data previously fetched in checkout.
            const checkoutPaymentOptions = this.checkoutPaymentOptions!;
            if (checkoutRequest.callbackUrl && checkoutRequest.csrf) {
                try {
                    const fetchedPaymentOptions = await CheckoutServerApi.fetchPaymentOption(
                        checkoutRequest.callbackUrl, Currency.NIM, checkoutPaymentOptions.type, checkoutRequest.csrf);
                    checkoutPaymentOptions.update(fetchedPaymentOptions);
                } catch (e) {
                    this.$rpc.reject(e);
                    return;
                }
            }
            if (!checkoutPaymentOptions.protocolSpecific.recipient) {
                this.$rpc.reject(new Error('Failed to fetch checkout recipient.'));
                return;
            }

            sender = Nimiq.Address.fromUserFriendlyAddress(this.$store.state.activeUserFriendlyAddress);
            value = checkoutPaymentOptions.amount;
            ({ recipient, fee, flags } = checkoutPaymentOptions.protocolSpecific);
            data = checkoutRequest.data;

            this.recipientDetails = {
                address: recipient.toUserFriendlyAddress(),
                label: this.rpcState.origin.split('://')[1],
                image: checkoutRequest.shopLogoUrl,
            };

            // Usually instant as synced in checkout. Only on reload we have to resync.
            validityStartHeightPromise = network.getBlockchainHeight().then((blockchainHeight) =>
                blockchainHeight + 1 // The next block is the earliest for which tx are accepted by standard miners
                - TX_VALIDITY_WINDOW
                + checkoutPaymentOptions.protocolSpecific.validityDuration,
            );

            // synchronize time in background
            if (checkoutPaymentOptions.expires) {
                this._initializeCheckoutExpiryTimer().catch((e) => this.$rpc.reject(e));
            }
        } else {
            this.$rpc.reject(new Error('Must be invoked via sign-transaction or checkout requests.'));
            return;
        }

        // we know that these exist as their existence was already checked in RpcApi.ts
        const senderUserFriendlyAddress = sender.toUserFriendlyAddress();
        const senderAccount = this.findWalletByAddress(senderUserFriendlyAddress, true)!;
        const senderContract = senderAccount.findContractByAddress(sender);
        const signer = senderAccount.findSignerForAddress(sender)!;

        this.senderDetails = {
            address: senderUserFriendlyAddress,
            label: (senderContract || signer).label || senderUserFriendlyAddress,
            walletLabel: senderAccount.label,
            balance: (senderContract || signer).balance,
        };

        let validityStartHeight;
        try {
            validityStartHeight = await validityStartHeightPromise;
        } catch (e) {
            this.$rpc.reject(e);
            return;
        }

        // sign transaction
        let signedTransaction;
        try {
            signedTransaction = await LedgerApi.signTransaction({
                sender: (senderContract || signer).address,
                senderType: senderContract ? senderContract.type : Nimiq.Account.Type.BASIC,
                recipient,
                value,
                fee,
                validityStartHeight,
                network: Config.network,
                extraData: data,
                flags,
            }, signer.path, senderAccount.keyId);
        } catch (e) {
            // If cancelled and not expired, handle the exception. Otherwise just keep the ledger ui / expiry error
            // message displayed.
            if (this.state !== SignTransactionLedger.State.EXPIRED
                && e.message.toLowerCase().indexOf('cancelled') !== -1) {
                if (this.request.kind === RequestType.CHECKOUT
                    && (!this.checkoutPaymentOptions!.protocolSpecific.sender
                    || !sender.equals(this.checkoutPaymentOptions!.protocolSpecific.sender))) {
                    // If user got here after selecting an account in the checkout flow (which was not automatically
                    // selected via the checkout request) he might want to switch to another one
                    this._back();
                } else {
                    this._close();
                }
            }
            return;
        }

        this.shownAccountDetails = null;

        // send transaction to network and finish
        let result;
        if (this.request.kind === RequestType.CHECKOUT) {
            this.state = SignTransactionLedger.State.SENDING_TRANSACTION;
            result = await network.sendToNetwork(signedTransaction);
        } else {
            result = await network.makeSignTransactionResult(signedTransaction);
        }

        this.state = SignTransactionLedger.State.FINISHED;
        await new Promise((resolve) => setTimeout(resolve, StatusScreen.SUCCESS_REDIRECT_DELAY));
        this.$rpc.resolve(result);
    }

    private destroyed() {
        clearTimeout(this._checkoutExpiryTimeout);
        this._cancelLedgerRequest();
    }

    private get checkoutPaymentOptions() {
        if (this.request.kind !== RequestType.CHECKOUT) return null;
        const checkoutRequest = this.request as ParsedCheckoutRequest;
        return checkoutRequest.paymentOptions.find(
            (option) => option.currency === Currency.NIM,
        ) as ParsedNimiqDirectPaymentOptions;
    }

    private get transactionData() {
        if (!this.request.data || this.request.data.byteLength === 0) {
            return null;
        }

        if (Nimiq.BufferUtils.equals(this.request.data, CASHLINK_FUNDING_DATA)) {
            return 'Funding cashlink';
        }

        let flags;
        if (this.request.kind === RequestType.SIGN_TRANSACTION) {
            const signTransactionRequest = this.request as ParsedSignTransactionRequest;
            flags = signTransactionRequest.flags;
        } else {
            flags = this.checkoutPaymentOptions!.protocolSpecific.flags;
        }
        // tslint:disable-next-line no-bitwise
        if ((flags & Nimiq.Transaction.Flag.CONTRACT_CREATION) > 0) {
            // TODO: Decode contract creation transactions
            // return ...
        }

        return Utf8Tools.isValidUtf8(this.request.data, true)
            ? Utf8Tools.utf8ByteArrayToString(this.request.data)
            : Nimiq.BufferUtils.toHex(this.request.data);
    }

    private get statusScreenState() {
        switch (this.state) {
            case SignTransactionLedger.State.FINISHED:
                return StatusScreen.State.SUCCESS;
            case SignTransactionLedger.State.EXPIRED:
                return StatusScreen.State.WARNING;
            default:
                return StatusScreen.State.LOADING;
        }
    }

    private get statusScreenTitle() {
        switch (this.state) {
            case SignTransactionLedger.State.SENDING_TRANSACTION:
                return 'Sending Transaction';
            case SignTransactionLedger.State.FINISHED:
                return this.request.kind === RequestType.SIGN_TRANSACTION
                    ? 'Transaction Signed'
                    : 'Transaction Sent';
            case SignTransactionLedger.State.EXPIRED:
                return 'The offer expired.';
            default:
                return '';
        }
    }

    private async _initializeCheckoutExpiryTimer() {
        if (!this.checkoutPaymentOptions || !this.checkoutPaymentOptions.expires) return;
        const checkoutRequest = this.request as ParsedCheckoutRequest;
        if (!checkoutRequest.callbackUrl || !checkoutRequest.csrf) {
            throw new Error('callbackUrl and csrf token are required to fetch time.');
        }
        const referenceTime = await CheckoutServerApi.fetchTime(checkoutRequest.callbackUrl, checkoutRequest.csrf);
        (this.$refs.info as PaymentInfoLine).setTime(referenceTime);
        clearTimeout(this._checkoutExpiryTimeout);
        this._checkoutExpiryTimeout = window.setTimeout(
            () => {
                this.shownAccountDetails = null;
                this.state = SignTransactionLedger.State.EXPIRED;
                this._cancelLedgerRequest();
            },
            this.checkoutPaymentOptions.expires - referenceTime,
        );
    }

    private _back() {
        window.history.back();
    }

    private _close() {
        if (this.state !== SignTransactionLedger.State.OVERVIEW
            && this.state !== SignTransactionLedger.State.EXPIRED) return;
        const error = this.state === SignTransactionLedger.State.EXPIRED ? ERROR_REQUEST_TIMED_OUT : ERROR_CANCELED;
        this.$rpc.reject(new Error(error));
    }

    private _cancelLedgerRequest() {
        const currentRequest = LedgerApi.currentRequest;
        if (currentRequest && currentRequest.type === LedgerApi.RequestType.SIGN_TRANSACTION) {
            currentRequest.cancel();
        }
    }

    @Watch('shownAccountDetails')
    @Watch('state')
    private _updateLedgerUiAnimationPlayState() {
        const ledgerUi = this.$refs['ledger-ui'] as LedgerUi;
        // Before blur pause immediately, otherwise update after unblur / transition to success screen
        const waitTime = !!this.shownAccountDetails ? 0 : 400;
        setTimeout(() => ledgerUi.$el.classList.toggle('animations-paused',
            !!this.shownAccountDetails || this.state !== SignTransactionLedger.State.OVERVIEW), waitTime);
    }
}
</script>

<style scoped>
    .small-page {
        /* TODO we should stick to the 70rem default height here, but auto is how the keyguard sign tx screen behaves */
        height: auto;
        min-height: 70.5rem;
        position: relative;
        align-items: center;
        padding: 3.75rem 4rem 26rem; /* bottom padding for bottom container + additional padding */
        overflow: hidden; /* avoid overflow of blurred elements */
    }

    .info-line {
        align-self: stretch;
        margin: -2rem -1.5rem 3rem;
    }

    .page-header {
        align-self: stretch;
        padding: 0;
        margin-bottom: 4rem; /* use margin instead of padding to reduce area on which to apply expensive blur */
    }

    .page-header >>> .page-header-back-button {
        top: 0;
        left: .5rem;
    }

    .accounts {
        display: flex;
        align-self: stretch;
        margin-top: .75rem;
        margin-bottom: 3.25rem;
    }

    .accounts .account {
        width: calc(50% - 1.5rem); /* minus half arrow width */
        padding: 0;
        cursor: pointer;
    }

    .accounts .account >>> .identicon {
        transition: transform 0.45s ease;
    }

    .accounts .account:hover >>> .identicon {
        transform: scale(1.1);
    }

    .accounts .arrow-right {
        font-size: 3rem;
        margin-top: 3.5rem;
        color: var(--nimiq-light-blue);
    }

    hr {
        width: 100%;
        height: 1px;
        margin: 0;
        border: none;
        background: #1F2348;
        opacity: .1;
    }

    .value {
        font-size: 5rem;
        margin-top: 2rem;
    }

    .value >>> .nim {
        margin-left: -.25rem;
        font-size: 2.25rem;
        font-weight: 700;
    }

    .fee {
        opacity: .5;
    }

    .data {
        margin: .25rem 3rem 0;
        opacity: 1;
        color: var(--nimiq-blue);
    }

    .bottom-container {
        position: absolute;
        width: 100%;
        height: 23rem;
        bottom: 0;
        z-index: 0;
        transition: filter .4s, height .4s !important;
    }

    .bottom-container.full-height {
        height: 100%;
    }

    .bottom-container > * {
        position: absolute;
        top: 0;
    }

    .ledger-ui {
        width: 100%;
        height: 100%;
    }

    .ledger-ui.animations-paused >>> * {
        animation-play-state: paused !important;
        transition: none !important;
    }

    .status-screen {
        transition: opacity .4s;
    }

    .status-screen .stopwatch-icon {
        font-size: 15.5rem;
    }

    .account-details {
        position: absolute;
        top: 0;
        transition: opacity .4s;
        background: rgba(255, 255, 255, .875); /* equivalent to keyguard: .5 on blurred and .75 on account details */
    }

    .blur-target {
        transition: filter .4s;
    }

    .account-details-shown .blur-target {
        filter: blur(20px);
    }
    .account-details-shown .bottom-container {
        filter: blur(35px);
    }
</style>
