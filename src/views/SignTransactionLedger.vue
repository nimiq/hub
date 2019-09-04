<template>
    <div class="container">
        <SmallPage :class="{ 'account-details-shown': !!shownAccountDetails }">
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
                :amount="this.request.value" :minDecimals="2" :maxDecimals="5" />

            <div v-if="request.fee" class="fee nq-text-s blur-target">
                + <Amount :amount="this.request.fee" :minDecimals="2" :maxDecimals="5" /> fee
            </div>

            <div v-if="transactionData" class="data nq-text blur-target">
                {{ transactionData }}
            </div>

            <div class="bottom-container blur-target" :class="{ 'full-height': state !== constructor.State.OVERVIEW }">
                <LedgerUi ref="ledger-ui" small></LedgerUi>
                <transition name="transition-fade">
                    <StatusScreen v-if="state !== constructor.State.OVERVIEW"
                        :state="state === constructor.State.FINISHED ? 'success' : 'loading'"
                        :title="statusScreenTitle">
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
    PageBody,
    PageHeader,
    SmallPage,
    Amount,
    ArrowLeftSmallIcon,
    ArrowRightIcon,
} from '@nimiq/vue-components';
import Network from '@/components/Network.vue';
import LedgerApi from '../lib/LedgerApi';
import LedgerUi from '../components/LedgerUi.vue';
import StatusScreen from '../components/StatusScreen.vue';
import { Static } from '../lib/StaticStore';
import { Getter } from 'vuex-class';
import { State as RpcState } from '@nimiq/rpc';
import {
    ParsedCheckoutRequest,
    ParsedSignTransactionRequest,
} from '../lib/RequestTypes';
import { Currency, RequestType } from '../lib/PublicRequestTypes';
import { WalletInfo } from '../lib/WalletInfo';
import { ERROR_CANCELED, TX_VALIDITY_WINDOW, CASHLINK_FUNDING_DATA } from '../lib/Constants';
import { ParsedNimiqDirectPaymentOptions } from '../lib/paymentOptions/NimiqPaymentOptions';
import { Utf8Tools } from '@nimiq/utils';
import Config from 'config';

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
    SmallPage,
    LedgerUi,
    StatusScreen,
    AccountDetails,
    Network,
    Amount,
    ArrowLeftSmallIcon,
    ArrowRightIcon,
}})
export default class SignTransactionLedger extends Vue {
    private static readonly State = {
        OVERVIEW: 'overview',
        SENDING_TRANSACTION: 'sending-transaction',
        FINISHED: 'finished',
    };

    @Static private rpcState!: RpcState;
    @Static private request!: ParsedSignTransactionRequest | ParsedCheckoutRequest;
    @Getter private findWalletByAddress!: (address: string, includeContracts: boolean) => WalletInfo | undefined;

    private state: string = SignTransactionLedger.State.OVERVIEW;
    private senderDetails!: AccountDetailsData;
    private recipientDetails!: AccountDetailsData;
    private shownAccountDetails: AccountDetailsData | null = null;

    private created() {
        let senderUserFriendlyAddress: string;
        if (this.request.kind === RequestType.SIGN_TRANSACTION) {
            // direct sign transaction request invocation
            const signTransactionRequest = this.request as ParsedSignTransactionRequest;
            senderUserFriendlyAddress = signTransactionRequest.sender.toUserFriendlyAddress();

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

            senderUserFriendlyAddress = this.$store.state.activeUserFriendlyAddress;

            /*
             * There has to be a NIM paymentOption so find will always return a result.
             */
            const recipient = (this.request as ParsedSignTransactionRequest).recipient
                || ((this.request as ParsedCheckoutRequest).paymentOptions.find(
                        (option) => option.currency === Currency.NIM,
                    ) as ParsedNimiqDirectPaymentOptions).protocolSpecific.recipient;
            if (!recipient) {
                this.$rpc.reject(new Error('recipient not found/fetched'));
                return;
            }
            this.recipientDetails = {
                address: recipient.toUserFriendlyAddress(),
                label: this.rpcState.origin.split('://')[1],
                image: checkoutRequest.shopLogoUrl,
            };
        } else {
            this.$rpc.reject(new Error('Must be invoked via sign-transaction or checkout requests.'));
            return;
        }

        // we know that these exist as their existence was already checked in RpcApi.ts
        const senderAddress = Nimiq.Address.fromUserFriendlyAddress(senderUserFriendlyAddress);
        const senderAccount = this.findWalletByAddress(senderUserFriendlyAddress, true)!;
        const senderContract = senderAccount.findContractByAddress(senderAddress);
        const signer = senderAccount.findSignerForAddress(senderAddress)!;

        this.senderDetails = {
            address: senderUserFriendlyAddress,
            label: (senderContract || signer).label || senderUserFriendlyAddress,
            walletLabel: senderAccount.label,
            balance: (senderContract || signer).balance,
        };
    }

    private async mounted() {
        const network = this.$refs.network as Network;

        let recipient: Nimiq.Address;
        let value: number;
        let fee: number;
        let flags: number;
        let validityStartHeight: number;

        if (this.request.kind === RequestType.SIGN_TRANSACTION) {
            const signTransactionRequest = this.request as ParsedSignTransactionRequest;
            recipient = signTransactionRequest.recipient;
            value = signTransactionRequest.value;
            fee = signTransactionRequest.fee;
            flags = signTransactionRequest.flags;
            validityStartHeight = signTransactionRequest.validityStartHeight;
        } else if (this.request.kind === RequestType.CHECKOUT) {
            const checkoutRequest = this.request as ParsedCheckoutRequest;
            // Once currency selection is implemented likely no longer needed
            const nimiqPaymentOption = (checkoutRequest.paymentOptions.find(
                    (option) => option.currency === Currency.NIM,
                ) as ParsedNimiqDirectPaymentOptions);
            recipient = nimiqPaymentOption.protocolSpecific.recipient!;
            value = nimiqPaymentOption.amount;
            fee = nimiqPaymentOption.protocolSpecific.fee!;
            flags = nimiqPaymentOption.protocolSpecific.flags;
            const blockchainHeight = await network.getBlockchainHeight(); // usually instant as synced in checkout
            // The next block is the earliest for which tx are accepted by standard miners
            validityStartHeight = blockchainHeight + 1
                - TX_VALIDITY_WINDOW
                + nimiqPaymentOption.protocolSpecific.validityDuration!;
        } else {
            // this case get's rejected in created
            return;
        }

        const senderAddress = Nimiq.Address.fromUserFriendlyAddress(this.senderDetails.address);
        const senderAccount = this.findWalletByAddress(this.senderDetails.address, true)!;
        const senderContract = senderAccount.findContractByAddress(senderAddress);
        const signer = senderAccount.findSignerForAddress(senderAddress)!;

        let signedTransaction;
        try {
            signedTransaction = await LedgerApi.signTransaction({
                sender: (senderContract || signer).address,
                senderType: senderContract ? senderContract.type : Nimiq.Account.Type.BASIC,
                recipient,
                value,
                fee: fee || 0,
                validityStartHeight,
                network: Config.network,
                extraData: this.request.data,
                flags,
            }, signer.path, senderAccount.keyId);
        } catch (e) {
            // If cancelled, handle the exception. Otherwise just keep the error message displayed in ledger ui.
            if (e.message.toLowerCase().indexOf('cancelled') !== -1) {
                if (this.request.kind === RequestType.CHECKOUT) {
                    this._back(); // user might want to choose another account or address
                } else {
                    this._close();
                }
            }
            return;
        }

        this.shownAccountDetails = null;

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
        const currentRequest = LedgerApi.currentRequest;
        if (currentRequest && currentRequest.type === LedgerApi.RequestType.SIGN_TRANSACTION) {
            currentRequest.cancel();
        }
    }

    private get transactionData() {
        if (!this.request.data || this.request.data.byteLength === 0) {
            return null;
        }

        if (Nimiq.BufferUtils.equals(this.request.data, CASHLINK_FUNDING_DATA)) {
            return 'Funding cashlink';
        }

        const flags = (this.request as ParsedSignTransactionRequest).flags
            || ((this.request as ParsedCheckoutRequest).paymentOptions.find(
                (option) => option.currency === Currency.NIM,
            ) as ParsedNimiqDirectPaymentOptions).protocolSpecific.flags;
        // tslint:disable-next-line no-bitwise
        if ((flags & Nimiq.Transaction.Flag.CONTRACT_CREATION) > 0) {
            // TODO: Decode contract creation transactions
            // return ...
        }

        return Utf8Tools.isValidUtf8(this.request.data, true)
            ? Utf8Tools.utf8ByteArrayToString(this.request.data)
            : Nimiq.BufferUtils.toHex(this.request.data);
    }

    private get statusScreenTitle() {
        switch (this.state) {
            case SignTransactionLedger.State.SENDING_TRANSACTION:
                return 'Sending Transaction';
            case SignTransactionLedger.State.FINISHED:
                return this.request.kind === RequestType.SIGN_TRANSACTION
                    ? 'Transaction Signed'
                    : 'Transaction Sent';
            default:
                return '';
        }
    }

    private _back() {
        window.history.back();
    }

    private _close() {
        if (this.state !== SignTransactionLedger.State.OVERVIEW) return;
        this.$rpc.reject(new Error(ERROR_CANCELED));
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
