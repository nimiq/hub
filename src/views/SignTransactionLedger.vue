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
                <div class="nq-icon arrow-right blur-target"></div>
                <Account layout="column"
                    :address="recipientDetails.address"
                    :label="recipientDetails.label"
                    :image="recipientDetails.image"
                    @click.native="shownAccountDetails = recipientDetails"
                    class="blur-target">
                </Account>
            </div>

            <hr class="blur-target">

            <div class="value nq-light-blue blur-target">
                {{ transactionValue }}
                <span class="nim-symbol">NIM</span>
            </div>

            <div v-if="request.fee" class="fee nq-text-s blur-target">
                includes {{ transactionFee }} NIM fee
            </div>

            <div v-if="transactionData" class="data nq-text blur-target">
                {{ transactionData }}
            </div>

            <div class="bottom-container blur-target" :class="{ 'full-height': state !== constructor.State.OVERVIEW }">
                <LedgerUi ref="ledger-ui" small></LedgerUi>
                <transition name="transition-fade">
                    <Loader v-if="state !== constructor.State.OVERVIEW"
                        :state="state === constructor.State.FINISHED ? 'success' : 'loading'"
                        :title="loaderTitle">
                    </Loader>
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
            <span class="nq-icon arrow-left"></span>
            {{ request.kind === 'checkout' ? 'Cancel Payment' : `Back to ${request.appName}` }}
        </button>
        <Network ref="network" :visible="false"/>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Watch } from 'vue-property-decorator';
import { Account, AccountDetails, PageBody, PageHeader, SmallPage } from '@nimiq/vue-components';
import Network from '@/components/Network.vue';
import LedgerApi from '../lib/LedgerApi';
import LedgerUi from '../components/LedgerUi.vue';
import Loader from '../components/Loader.vue';
import { Static } from '../lib/StaticStore';
import { Getter } from 'vuex-class';
import { State as RpcState } from '@nimiq/rpc';
import { ParsedCheckoutRequest, ParsedSignTransactionRequest, RequestType } from '../lib/RequestTypes';
import { WalletInfo } from '../lib/WalletInfo';
import { AccountInfo } from '../lib/AccountInfo';
import { ContractInfo } from '../lib/ContractInfo';
import { ERROR_CANCELED, TX_VALIDITY_WINDOW } from '../lib/Constants';
import { Utf8Tools } from '@nimiq/utils';
import Config from 'config';

interface AccountDetailsData {
    address: string;
    label: string;
    image?: string;
    walletLabel?: string;
    balance?: number;
}

@Component({components: {Account, PageBody, PageHeader, SmallPage, LedgerUi, Loader, AccountDetails, Network }})
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

            this.recipientDetails = {
                address: checkoutRequest.recipient.toUserFriendlyAddress(),
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

        let validityStartHeight;
        if (this.request.kind === RequestType.SIGN_TRANSACTION) {
            const signTransactionRequest = this.request as ParsedSignTransactionRequest;
            validityStartHeight = signTransactionRequest.validityStartHeight;
        } else if (this.request.kind === RequestType.CHECKOUT) {
            const checkoutRequest = this.request as ParsedCheckoutRequest;
            const blockchainHeight = await network.getBlockchainHeight(); // usually instant as synced in checkout
            // The next block is the earliest for which tx are accepted by standard miners
            validityStartHeight = blockchainHeight + 1
                - TX_VALIDITY_WINDOW
                + checkoutRequest.validityDuration;
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
                recipient: this.request.recipient,
                value: this.request.value,
                fee: this.request.fee || 0,
                validityStartHeight,
                network: Config.network,
                extraData: this.request.data,
                flags: this.request.flags,
            }, signer.path, senderAccount.id);
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
        await new Promise((resolve) => setTimeout(resolve, Loader.SUCCESS_REDIRECT_DELAY));
        this.$rpc.resolve(result);
    }

    private destroyed() {
        const currentRequest = LedgerApi.currentRequest;
        if (currentRequest && currentRequest.type === LedgerApi.RequestType.SIGN_TRANSACTION) {
            currentRequest.cancel();
        }
    }

    private get transactionValue() {
        return Nimiq.Policy.satoshisToCoins(this.request.value);
    }

    private get transactionFee() {
        return Nimiq.Policy.satoshisToCoins(this.request.fee || 0);
    }

    private get transactionData() {
        return this.request.data && this.request.data.length > 0
            ? Utf8Tools.utf8ByteArrayToString(this.request.data)
            : null;
    }

    private get loaderTitle() {
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
        padding: 4rem 4rem 26rem; /* bottom padding for bottom container + additional padding */
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
        margin-top: 2rem;
        margin-bottom: 4rem;
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
        width: 3rem;
        margin-top: 4rem;
        /* filter that rotates color to nimiq-light-blue.
        TODO not necessary anymore once @nimiq/style is updated to svg icons */
        filter: hue-rotate(-38deg) saturate(1.34) brightness(2.95);
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
        margin-top: 3rem;
    }

    .value .nim-symbol {
        font-size: 2.25rem;
        font-weight: 700;
    }

    .fee {
        opacity: .5;
    }

    .data {
        margin: .5rem 7rem 0;
        opacity: 1;
        text-align: center;
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

    .loader {
        transition: opacity .4s;
    }

    .account-details {
        position: absolute;
        top: 0;
        transition: opacity .4s;
        background: rgba(255, 255, 255, .875); /* equivalent to keyguard: .5 on blurred and .75 on account details */
    }

    .transition-fade-enter,
    .transition-fade-leave-to {
        opacity: 0;
    }

    .blur-target {
        transition: filter .4s;
    }

    .account-details-shown .blur-target {
        filter: blur(20px);
    }
    .account-details-shown .accounts .arrow-right {
        filter: hue-rotate(-38deg) saturate(1.34) brightness(2.95) blur(20px);
    }
    .account-details-shown .bottom-container {
        filter: blur(35px);
    }
</style>