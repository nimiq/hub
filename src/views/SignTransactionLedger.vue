<template>
    <div v-if="transactions.length" class="container">
        <SmallPage :class="{ 'account-details-shown': !!shownAccountDetails }">
            <template v-if="showsTransactionDetails">
                <PaymentInfoLine
                    v-if="request.kind === 'checkout'"
                    ref="info"
                    class="blur-target"
                    :cryptoAmount="{
                        amount: checkoutPaymentOptions.amount,
                        currency: checkoutPaymentOptions.currency,
                        decimals: checkoutPaymentOptions.decimals,
                    }"
                    :fiatAmount="request.fiatAmount && request.fiatCurrency ? {
                        amount: request.fiatAmount,
                        currency: request.fiatCurrency,
                    } : null"
                    :fiatApiProvider="constructor.FIAT_API_PROVIDER"
                    :vendorMarkup="checkoutPaymentOptions.vendorMarkup"
                    :networkFee="checkoutPaymentOptions.fee"
                    :address="checkoutPaymentOptions.protocolSpecific.recipient
                        ? checkoutPaymentOptions.protocolSpecific.recipient.toUserFriendlyAddress()
                        : null"
                    :origin="rpcState.origin"
                    :shopLogoUrl="request.shopLogoUrl"
                    :startTime="request.time"
                    :endTime="checkoutPaymentOptions.expires"
                />
                <PageHeader :back-arrow="request.kind === 'checkout' || request.kind === 'create-cashlink'"
                    @back="_back" class="blur-target">
                    {{ pageHeaderTitle }}
                </PageHeader>

                <div class="accounts">
                    <Account layout="column"
                        :address="senderDetails.address"
                        :label="senderDetails.label || senderDetails.address"
                        :image="senderDetails.image"
                        @click.native="shownAccountDetails = senderDetails"
                        class="blur-target">
                    </Account>
                    <ArrowRightIcon class="arrow-right blur-target"/>
                    <Account layout="column"
                        :address="recipientDetails.address"
                        :label="recipientDetails.label || recipientDetails.address"
                        :image="recipientDetails.image"
                        :displayAsCashlink="recipientDetails.isCashlink"
                        @click.native="shownAccountDetails = recipientDetails.isCashlink ? null : recipientDetails"
                        class="blur-target">
                    </Account>
                </div>

                <hr class="blur-target">

                <Amount class="value nq-light-blue blur-target"
                    :amount="amountAndFee.amount"
                    :minDecimals="2"
                    :maxDecimals="5"
                />

                <div v-if="amountAndFee.fee"
                    class="fee nq-text-s blur-target">
                    + <Amount
                        :amount="amountAndFee.fee"
                        :minDecimals="2" :maxDecimals="5"
                    /> {{ $t('fee') }}
                </div>

                <div v-if="transactionData" class="data nq-text blur-target">
                    {{ transactionData }}
                </div>
            </template>

            <div class="bottom-container blur-target"
                :class="{ 'full-height': !showsTransactionDetails || state !== constructor.State.OVERVIEW }">
                <LedgerUi ref="ledger-ui" :small="showsTransactionDetails" :signingStep="signingStep"></LedgerUi>
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
                            <p class="message nq-text">{{ $t('Please go back to the shop and restart the process.') }}</p>
                        </template>
                    </StatusScreen>
                </transition>
            </div>

            <transition name="transition-fade">
                <AccountDetails v-if="shownAccountDetails"
                    :address="shownAccountDetails.address"
                    :image="shownAccountDetails.image"
                    :label="shownAccountDetails.label || shownAccountDetails.address"
                    :walletLabel="shownAccountDetails.walletLabel"
                    :balance="shownAccountDetails.balance"
                    @close="shownAccountDetails = null">
                </AccountDetails>
            </transition>
        </SmallPage>

        <GlobalClose :buttonLabel="request.kind === 'checkout' ? $t('Cancel payment') : '' /* use default */"
            :onClose="_close" :hidden="state !== constructor.State.OVERVIEW" />
        <Network ref="network" />
    </div>
</template>

<script lang="ts">
import { Component, Vue, Watch } from 'vue-property-decorator';
import {
    Account,
    AccountDetails,
    Amount,
    ArrowRightIcon,
    PageBody,
    PageHeader,
    PaymentInfoLine,
    SmallPage,
    StopwatchIcon,
} from '@nimiq/vue-components';
import Network from '../components/Network.vue';
import LedgerApi, {
    RequestTypeNimiq as LedgerApiRequestType,
    Network as LedgerApiNetwork,
    AccountTypeNimiq as LedgerApiAccountTypeNimiq,
    TransactionInfoNimiq as LedgerApiTransactionInfoNimiq,
} from '@nimiq/ledger-api';
import StatusScreen from '../components/StatusScreen.vue';
import GlobalClose from '../components/GlobalClose.vue';
import LedgerUi from '../components/LedgerUi.vue';
import { Static } from '../lib/StaticStore';
import { Getter } from 'vuex-class';
import { State as RpcState } from '@nimiq/rpc';
import {
    ParsedSignTransactionRequest,
    ParsedSignStakingRequest,
    ParsedCreateCashlinkRequest,
    ParsedCheckoutRequest,
    SignTransactionRequestLayout,
} from '../lib/RequestTypes';
import { Currency, RequestType, SignedTransaction } from '../../client/PublicRequestTypes';
import { patchLegacyRequestSenderType } from '../lib/SignTransactionRequestParsing';
import { WalletInfo } from '../lib/WalletInfo';
import {
    ERROR_CANCELED,
    ERROR_REQUEST_TIMED_OUT,
    TX_VALIDITY_WINDOW,
    FIAT_API_PROVIDER,
} from '../lib/Constants';
import { ParsedNimiqDirectPaymentOptions } from '../lib/paymentOptions/NimiqPaymentOptions';
import { Utf8Tools } from '@nimiq/utils';
import Config from 'config';
import Cashlink from '../lib/Cashlink';
import { CashlinkStore } from '../lib/CashlinkStore';
import CheckoutServerApi from '../lib/CheckoutServerApi';

// Placeholder validity start height for the transactions the Hub creates itself, i.e. for checkout and cashlink
// requests, the actual height of which is only fetched from the network when the transactions are to be signed, see
// mounted().
const PLACEHOLDER_VALIDITY_START_HEIGHT = 0;

interface AccountDetailsData {
    address: string;
    label?: string;
    image?: string;
    walletLabel?: string;
    balance?: number;
    isCashlink?: boolean;
}

interface UserAccountInfo {
    // Key to sign the request's transactions with.
    keyId: string;
    keyPath: string;
    // Type of the user's address, i.e. basic, or a contract type for contracts.
    accountType: Nimiq.AccountType;
    // Data to display for the user's address, where it is rendered.
    label?: string;
    walletLabel?: string;
    balance?: number;
}

interface StakingValidatorInfo {
    validatorAddress?: string;
    validatorImageUrl?: string;
    // Only set for update-staker transactions, for which the sender is rendered as the old validator.
    fromValidatorAddress?: string;
    fromValidatorImageUrl?: string;
    // Labels are provided via senderLabel and/or recipientLabel on the request.
}

@Component({components: {
    Account,
    PageBody,
    PageHeader,
    PaymentInfoLine,
    SmallPage,
    LedgerUi,
    StatusScreen,
    GlobalClose,
    AccountDetails,
    Network,
    Amount,
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
    private static readonly FIAT_API_PROVIDER = FIAT_API_PROVIDER;

    @Static private rpcState!: RpcState;
    @Static private request!: ParsedSignTransactionRequest
        | ParsedSignStakingRequest
        | ParsedCheckoutRequest
        | ParsedCreateCashlinkRequest;
    @Static private cashlink?: Cashlink;
    @Getter private findWalletByAddress!: (address: string, includeContracts: boolean) => WalletInfo | undefined;

    private state: string = SignTransactionLedger.State.OVERVIEW;
    private senderDetails: AccountDetailsData = { address: '' };
    private recipientDetails: AccountDetailsData = { address: '' };
    private shownAccountDetails: AccountDetailsData | null = null;
    private isDestroyed: boolean = false;
    private currentlySignedTransactionIndex: number = 0;
    // Counter to be incremented after in-place changes to the request, which is not reactive itself, to re-evaluate
    // the getters that are based on it, see transactions getter.
    private requestRevision: number = 0;
    // An error that prevented the request from being set up, see created().
    private _setupError: Error | null = null;
    private _checkoutExpiryTimeout: number = -1;

    private created() {
        if (this.request.kind !== RequestType.SIGN_TRANSACTION) return;
        try {
            // The legacy single-transaction request format does not support specifying the senderType, in which case it
            // is determined from the WalletStore. As the request's transaction is patched in place, this has to happen
            // before the transactions getter is evaluated for the first time, which the initial render does.
            patchLegacyRequestSenderType(
                this.request as ParsedSignTransactionRequest,
                this.userAccountInfo.accountType,
            );
        } catch (e) {
            // Vue swallows exceptions thrown in lifecycle hooks, which would leave the senderType unpatched while the
            // view renders as usual. Fail the request instead, see the transactions getter.
            this._setupError = e;
        }
    }

    private async mounted() {
        const requestKind = this.request.kind;
        const isSentByHub = this.isSentByHub;

        // A checkout's recipient may be omitted from the request and only be provided by the shop's callback, see
        // RequestParser. CheckoutCard fills it into the payment options in place, but it is lost on a reload, on which
        // the request is re-parsed from its original raw form. Defer the check for these requests until after the
        // payment options have been updated below.
        const canRecoverCheckoutRecipient = requestKind === RequestType.CHECKOUT
            && !!(this.request as ParsedCheckoutRequest).callbackUrl
            && !!(this.request as ParsedCheckoutRequest).csrf;

        const transactionsError = this.transactionsError;
        if (transactionsError && !canRecoverCheckoutRecipient) {
            // The request can not be handled. Note that nothing is rendered in this case, see the template's root.
            const isSupportedRequestKind = requestKind === RequestType.SIGN_TRANSACTION
                || requestKind === RequestType.SIGN_STAKING
                || requestKind === RequestType.CHECKOUT
                || requestKind === RequestType.CREATE_CASHLINK;
            if (!isSupportedRequestKind && history.length >= 3) {
                // First history entry is root, the second an original request handler invoking the transaction signing
                // and the third is this one. If there was an original request handler calling us but the intermediate
                // transaction signing request was lost on reload and instead the original request recovered from the
                // RPC state, navigate back to the original request handler.
                // TODO implementing a proper request call stack instead of the originalRouteName hack would avoid this
                history.back();
            } else {
                this.$rpc.reject(transactionsError);
            }
            return;
        }

        if (requestKind === RequestType.SIGN_TRANSACTION) {
            const { layout } = this.request as ParsedSignTransactionRequest;
            if (layout !== SignTransactionRequestLayout.STANDARD
                && layout !== SignTransactionRequestLayout.SWITCH_VALIDATOR
                && layout !== SignTransactionRequestLayout.UNSTAKING) {
                this.$rpc.reject(new Error(`Sign-transaction requests with the ${layout} layout are not yet supported `
                    + 'for Ledger accounts'));
                return;
            }
        }

        const network = this.$refs.network as Network;
        if (isSentByHub) {
            // Pre-connect to network when we know we'll need it. Does not need to be awaited, as the methods on network
            // that actually need to be connected, themselves ensure to be connected.
            network.getNetworkClient().catch(() => {}); // tslint:disable-line no-empty
        }

        // If user left this view in the meantime, don't continue
        if (this.isDestroyed) return;

        // Collect the request specific display information and side effects, and the validity start height for the
        // transactions the Hub creates itself. The transactions themselves are built in the transactions getter.
        let validityStartHeightPromise: Promise<number> | undefined;
        let recipientLabel = 'recipientLabel' in this.request ? this.request.recipientLabel : undefined;
        let recipientImage: string | undefined;
        let isRecipientCashlink = false;
        if (requestKind === RequestType.CHECKOUT) {
            // Coming from checkout
            const checkoutRequest = this.request as ParsedCheckoutRequest;
            const $subtitle = document.querySelector('.logo .logo-subtitle')!;
            $subtitle.textContent = 'Checkout'; // reapply the checkout subtitle in case the page was reloaded
            document.title = checkoutRequest.paymentOptions.length === 1
                && checkoutRequest.paymentOptions[0].currency === Currency.NIM
                ? 'Nimiq Checkout'
                : 'Crypto-Checkout powered by Nimiq';

            // Update checkout payment options. This is typically instant even after reload as CheckoutServerApi caches
            // the data previously fetched in checkout.
            const checkoutPaymentOptions = this.checkoutPaymentOptions!;
            if (checkoutRequest.callbackUrl && checkoutRequest.csrf) {
                try {
                    const fetchedPaymentOptions = await CheckoutServerApi.fetchPaymentOption(
                        checkoutRequest.callbackUrl,
                        checkoutPaymentOptions.currency,
                        checkoutPaymentOptions.type,
                        checkoutRequest.csrf,
                    );
                    checkoutPaymentOptions.update(fetchedPaymentOptions);
                    // The payment options were updated in place and are not reactive themselves, therefore trigger a
                    // re-evaluation of the getters based on them, especially of the transaction to sign and display.
                    this.requestRevision++;
                } catch (e) {
                    this.$rpc.reject(e);
                    return;
                }
            }
            const transactionsErrorForNewRequestRevision = this.transactionsError;
            if (transactionsErrorForNewRequestRevision) {
                this.$rpc.reject(transactionsErrorForNewRequestRevision);
                return;
            }

            recipientLabel = this.rpcState.origin.split('://')[1];
            recipientImage = checkoutRequest.shopLogoUrl;

            // Usually instant as synced in checkout. Only on reload we have to resync.
            validityStartHeightPromise = network.getBlockchainHeight().then((blockchainHeight) =>
                blockchainHeight + 1 // The next block is the earliest for which tx are accepted by standard miners
                - TX_VALIDITY_WINDOW
                + checkoutPaymentOptions.protocolSpecific.validityDuration,
            );

            // Synchronize time in background
            if (checkoutPaymentOptions.expires) {
                this._initializeCheckoutExpiryTimer().catch((e) => this.$rpc.reject(e));
            }
        } else if (requestKind === RequestType.CREATE_CASHLINK) {
            // Coming from cashlink create
            recipientLabel = this.$t('New Cashlink') as string;
            isRecipientCashlink = true;
            validityStartHeightPromise = network.getBlockchainHeight().then((blockchainHeight) => blockchainHeight + 1);
        }

        // Display the transaction info based on the final transaction, for all request types. Note that all optional
        // properties are initialized, also those that are only assigned below, to make them reactive.
        const transactions = this.transactions; // from here on the transactions should not change anymore
        const finalTransaction = this.finalTransaction;
        this.senderDetails = {
            address: finalTransaction.sender.toUserFriendlyAddress(), // might be not the user
            label: 'senderLabel' in this.request ? this.request.senderLabel : undefined,
            image: undefined,
            walletLabel: undefined,
            balance: undefined,
        };
        this.recipientDetails = {
            address: finalTransaction.recipient.toUserFriendlyAddress(), // might be the user
            label: recipientLabel,
            image: recipientImage,
            walletLabel: undefined,
            balance: undefined,
            isCashlink: isRecipientCashlink,
        };

        // Staking flows (SIGN_STAKING requests, and SIGN_TRANSACTION requests with a staking layout) are displayed
        // based on their validator info, see stakingValidatorInfo. Only the info to be displayed is extracted here,
        // not the info to create the transactions, which are built from the requests' transactions directly in the
        // transactions getter.
        const stakingValidatorInfo = this.stakingValidatorInfo;
        if (stakingValidatorInfo) {
            // Render the staking contract as the validator that is being staked with.
            const stakingContractDetails = finalTransaction.senderType === Nimiq.AccountType.Staking
                ? this.senderDetails
                : this.recipientDetails;
            // Only ever show a validator's image on a card that actually renders that validator's address.
            if (stakingValidatorInfo.validatorAddress) {
                stakingContractDetails.address = stakingValidatorInfo.validatorAddress;
                stakingContractDetails.image = stakingValidatorInfo.validatorImageUrl;
            }

            // For update-staker, render the sender as the old validator instead of as the user's address (the actual
            // sender), see stakingValidatorInfo.
            if (stakingValidatorInfo.fromValidatorAddress) {
                this.senderDetails.address = stakingValidatorInfo.fromValidatorAddress;
                this.senderDetails.image = stakingValidatorInfo.fromValidatorImageUrl;
            }
        }

        // Refine the display of the user's own address based on the signer info, see userAccountInfo. In the UI, the
        // user can represent the sender (typical case), recipient (for unstaking) or none of those (for update-staker /
        // switch-validator). If one of those is rendered as the user details, enrich them with the account's data.
        const userAddress = this.userAddress;
        const userAccountInfo = this.userAccountInfo;
        const userAddressDetails = [this.senderDetails, this.recipientDetails]
            .find(({ address }) => address === userAddress.toUserFriendlyAddress());
        if (userAddressDetails) {
            // The label of the user's own address from the user's account data always takes priority over requested
            // labels, which a caller must not be able to set for it.
            userAddressDetails.label = userAccountInfo.label;
            userAddressDetails.walletLabel = userAccountInfo.walletLabel;
            userAddressDetails.balance = userAccountInfo.balance;
        }

        // Sign transactions, and send to network, depending on the request type.
        const signedTransactions: SignedTransaction[] = [];
        for (
            this.currentlySignedTransactionIndex = 0;
            this.currentlySignedTransactionIndex < transactions.length;
            this.currentlySignedTransactionIndex++
        ) {
            const transaction = transactions[this.currentlySignedTransactionIndex];

            // If user left this view in the meantime, don't continue signing / sending the transactions
            if (this.isDestroyed) return;

            // Check whether transaction was already signed but not successfully sent before user reloaded the page.
            let signedTransaction = network.getUnrelayedTransactions({
                sender: transaction.sender,
                senderType: transaction.senderType,
                recipient: transaction.recipient,
                recipientType: transaction.recipientType,
                value: transaction.value,
                fee: transaction.fee,
                flags: transaction.flags,
                data: transaction.data,
                // The transactions created by the Hub only get their actual validity start height when they are
                // signed, so their placeholder height must not be matched, see PLACEHOLDER_VALIDITY_START_HEIGHT.
                validityStartHeight: isSentByHub ? undefined : transaction.validityStartHeight,
            })[0];
            if (!signedTransaction) {
                let { validityStartHeight } = transaction;
                if (isSentByHub) {
                    try {
                        if (!validityStartHeightPromise) throw new Error('Unexpected: no validityStartHeight');
                        validityStartHeight = await validityStartHeightPromise;
                    } catch (e) {
                        if (this.isDestroyed) return; // user is not on this view anymore
                        this.$rpc.reject(e);
                        return;
                    }
                }

                const transactionInfo: LedgerApiTransactionInfoNimiq<typeof Config.ledgerApiNimiqVersion> = {
                    sender: transaction.sender,
                    senderType: transaction.senderType as unknown as LedgerApiAccountTypeNimiq,
                    senderData: transaction.senderData,
                    recipient: transaction.recipient,
                    recipientType: transaction.recipientType as unknown as LedgerApiAccountTypeNimiq,
                    recipientData: transaction.data,
                    value: transaction.value,
                    fee: transaction.fee,
                    validityStartHeight, // the resolved height for Hub created transactions, never the placeholder
                    flags: transaction.flags,
                    network: Config.network as LedgerApiNetwork, // enforce configured network
                };

                try {
                    signedTransaction = await LedgerApi.Nimiq.signTransaction(
                        transactionInfo,
                        userAccountInfo.keyPath,
                        userAccountInfo.keyId,
                        Config.ledgerApiNimiqVersion,
                    );
                } catch (e) {
                    if (this.isDestroyed) return; // user is not on this view anymore
                    // If cancelled and not expired, handle the exception. Otherwise, just keep the ledger ui / expiry
                    // error message displayed.
                    if (this.state !== SignTransactionLedger.State.EXPIRED
                        && e.message.toLowerCase().indexOf('cancelled') !== -1) {
                        const isCheckoutRequestWithManuallySelectedAddress = requestKind === RequestType.CHECKOUT
                            && (
                                !this.checkoutPaymentOptions!.protocolSpecific.sender
                                || !transaction.sender.equals(this.checkoutPaymentOptions!.protocolSpecific.sender)
                            );

                        if (isCheckoutRequestWithManuallySelectedAddress
                            || requestKind === RequestType.CREATE_CASHLINK) {
                            // If user got here after selecting an account in the checkout flow (which was not
                            // automatically selected via the checkout request) he might want to switch to another one.
                            this._back();
                        } else {
                            this._close();
                        }
                    }
                    return;
                }
            }

            this.shownAccountDetails = null;

            // If user left this view in the meantime, don't continue
            if (this.isDestroyed) return;

            // Send transaction to network, depending on the request type, and finish
            if (isSentByHub) {
                this.state = SignTransactionLedger.State.SENDING_TRANSACTION;
                if (this.cashlink) {
                    // Store cashlink in database first to be safe when browser crashes during sending
                    await CashlinkStore.Instance.put(this.cashlink);
                }
                signedTransactions.push(await network.sendToNetwork(signedTransaction));
            } else { // SIGN_TRANSACTION or SIGN_STAKING
                signedTransactions.push(network.makeSignTransactionResult(signedTransaction));
            }
        }

        if (requestKind !== RequestType.CREATE_CASHLINK) {
            this.state = SignTransactionLedger.State.FINISHED;
            await new Promise((resolve) => setTimeout(resolve, StatusScreen.SUCCESS_REDIRECT_DELAY));
            // For SIGN_TRANSACTION, return a single result iff a single transaction was signed (same rule as in
            // the Keyguard); SIGN_STAKING always returns an array
            const result = requestKind !== RequestType.SIGN_STAKING && signedTransactions.length === 1
                ? signedTransactions[0]
                : signedTransactions;
            this.$rpc.resolve(result);
        } else {
            this.$router.replace({ name: RequestType.MANAGE_CASHLINK });
        }
    }

    private destroyed() {
        this.isDestroyed = true;
        clearTimeout(this._checkoutExpiryTimeout);
        this._cancelLedgerRequest();
    }

    /**
     * Whether the request's transactions are created by the Hub itself, instead of being provided by the caller or
     * request parser, and are also sent to the network by the Hub, instead of being returned to the caller.
     */
    private get isSentByHub(): boolean {
        return this.request.kind === RequestType.CHECKOUT || this.request.kind === RequestType.CREATE_CASHLINK;
    }

    private get checkoutPaymentOptions() {
        // tslint:disable-next-line no-unused-expression
        this.requestRevision; // re-evaluate on changes to the request
        if (this.request.kind !== RequestType.CHECKOUT) return null;
        const checkoutRequest = this.request as ParsedCheckoutRequest;
        return checkoutRequest.paymentOptions.find(
            (option) => option.currency === Currency.NIM,
        ) as ParsedNimiqDirectPaymentOptions;
    }

    private get transactions(): Nimiq.Transaction[] {
        const transactionsOrError = this.transactionsOrError;
        return transactionsOrError instanceof Error ? [] : transactionsOrError;
    }

    private get transactionsError(): Error | null {
        const transactionsOrError = this.transactionsOrError;
        return transactionsOrError instanceof Error ? transactionsOrError : null;
    }

    /**
     * The request's transactions to sign and display, or the reason why they can not be built. In error case nothing is
     * rendered, see the template's root element, and mounted() reports that reason or navigates back. As it's evaluated
     * during rendering, it must never throw.
     */
    private get transactionsOrError(): Nimiq.Transaction[] | Error {
        // tslint:disable-next-line no-unused-expression
        this.requestRevision; // re-evaluate on changes to the request
        if (this._setupError) return this._setupError;
        try {
            let transactions: Nimiq.Transaction[];
            switch (this.request.kind) {
                case RequestType.SIGN_TRANSACTION:
                    // Note that the transactions of legacy requests are patched already in created().
                    transactions = (this.request as ParsedSignTransactionRequest).transactions;
                    break;
                case RequestType.SIGN_STAKING:
                    transactions = (this.request as ParsedSignStakingRequest).transactions
                        .map((plainTransaction) => Nimiq.Transaction.fromPlain(plainTransaction));
                    break;
                case RequestType.CHECKOUT:
                case RequestType.CREATE_CASHLINK: {
                    // The transactions the Hub creates itself, which are transfers from the user's address.
                    let recipient: Nimiq.Address | undefined;
                    let recipientType: Nimiq.AccountType | undefined;
                    let recipientData: Uint8Array | undefined;
                    let value: number;
                    let fee: number;
                    let flags: number | undefined;
                    if (this.request.kind === RequestType.CHECKOUT) {
                        const checkoutPaymentOptions = this.checkoutPaymentOptions!;
                        const { protocolSpecific } = checkoutPaymentOptions;
                        ({ amount: value, fee } = checkoutPaymentOptions);
                        ({ recipient, recipientType, extraData: recipientData, flags } = protocolSpecific);
                    } else {
                        if (!this.cashlink) {
                            return new Error('Ledger Cashlink Signing expects the Cashlink to sign to be in the '
                                + 'static store.'); // see CashlinkCreate
                        }
                        ({ recipient, value, fee, recipientData } = this.cashlink.getFundingDetails());
                    }
                    // For checkout, the payment info might not include a recipient yet, see mounted.
                    if (!recipient) return new Error('Failed to fetch checkout recipient.');
                    transactions = [new Nimiq.Transaction(
                        this.userAddress, this.userAccountInfo.accountType, /* senderData */ undefined,
                        recipient, recipientType || Nimiq.AccountType.Basic, recipientData,
                        BigInt(value), BigInt(fee),
                        flags || Nimiq.TransactionFlag.None,
                        PLACEHOLDER_VALIDITY_START_HEIGHT, // the actual validity start height is set when signing
                        Config.nimiqNetworkId,
                    )];
                    break;
                }
                default:
                    return new Error('Ledger Transaction Signing must be invoked via sign-transaction, sign-staking, '
                        + 'checkout or cashlink requests.');
            }
            return transactions.length ? transactions : new Error('Unexpected: no transactions to sign.');
        } catch (e) {
            return e instanceof Error ? e : new Error(`Failed to build the transactions to sign: ${e}`);
        }
    }

    /**
     * The transaction the transaction details' display is currently based on for showsTransactionDetails.
     */
    private get finalTransaction(): Nimiq.Transaction {
        const transactions = this.transactions;
        return transactions[transactions.length - 1];
    }

    /**
     * The user's own address, which can be a regular address or a contract address, and for which the signing key is
     * resolved, see userAccountInfo. Depending on the request type and the transactions, it can be rendered as the
     * sender (typical case), as the recipient (for unstaking) or not at all (for update-staker / switch-validator).
     */
    private get userAddress(): Nimiq.Address {
        switch (this.request.kind) {
            case RequestType.SIGN_TRANSACTION: {
                // The request-level sender is the user's address for all layouts, as the request parsing binds basic
                // and contract senders to it, and outgoing staking transactions, e.g. remove-stake of the multi-tx
                // unstaking layout, to pay out to it, see parseSignTransactionRequest.
                const { sender } = this.request as ParsedSignTransactionRequest;
                return sender instanceof Nimiq.Address ? sender : sender.address;
            }
            case RequestType.SIGN_STAKING: {
                // For staking, the sender or recipient address might be the user's address, and there is no request-
                // level sender that the parser already parses this information to.
                const finalTransaction = this.finalTransaction;
                return finalTransaction.senderType === Nimiq.AccountType.Basic
                    ? finalTransaction.sender
                    : finalTransaction.recipient;
            }
            case RequestType.CHECKOUT:
            case RequestType.CREATE_CASHLINK:
                // For checkout and cashlink requests, the user chose the address to pay from, see CheckoutCardNimiq
                // and CashlinkCreate, which set it as the active address.
                return Nimiq.Address.fromString(this.$store.state.activeUserFriendlyAddress);
            default:
                throw new Error(`Unsupported request type: ${(this.request as { kind: string }).kind}`);
        }
    }

    /**
     * The key to sign the request's transactions with, the type of the user's address, and the data to display for it.
     * For SIGN_TRANSACTION requests with a sender info object, currently only for internal use in RefundSwapLedger,
     * this info comes from that object; for all other requests it is resolved from the WalletStore.
     */
    private get userAccountInfo(): UserAccountInfo {
        // Check the request kind explicitly. `'sender' in this.request` would be a structural check, which also
        // passes for a sender property smuggled into a sign-staking request, the parsing of which passes unknown
        // properties through, see RequestParser. A caller must not be able to provide the signer key or the labels
        // for the user's own address.
        const requestSender = this.request.kind === RequestType.SIGN_TRANSACTION
            ? (this.request as ParsedSignTransactionRequest).sender
            : undefined;
        if (requestSender && !(requestSender instanceof Nimiq.Address)) {
            // Internal sender information passed from RefundSwapLedger
            const { type, label, walletLabel, signerKeyId, signerKeyPath } = requestSender;
            return {
                keyId: signerKeyId,
                keyPath: signerKeyPath,
                accountType: type || Nimiq.AccountType.Basic,
                label,
                walletLabel,
            };
        }

        const userAddress = this.userAddress;
        // We know that these exist as their existence was already checked in RpcApi.ts
        const userAccount = this.findWalletByAddress(userAddress.toUserFriendlyAddress(), true)!;
        const userAccountContract = userAccount.findContractByAddress(userAddress);
        const userAccountSigner = userAccount.findSignerForAddress(userAddress)!;
        return {
            keyId: userAccount.keyId,
            keyPath: userAccountSigner.path,
            accountType: userAccountContract ? userAccountContract.type : Nimiq.AccountType.Basic,
            label: (userAccountContract || userAccountSigner).label,
            walletLabel: userAccount.label,
            balance: (userAccountContract || userAccountSigner).balance,
        };
    }

    /**
     * Validator info of staking flows, which are displayed based on their final transaction and this info: SIGN_STAKING
     * requests, and SIGN_TRANSACTION requests with a staking layout (switch-validator, unstaking). Null for other
     * requests. The from-validator info is only included for update-staker transactions, see StakingValidatorInfo.
     */
    private get stakingValidatorInfo(): StakingValidatorInfo | null {
        let validatorInfo: StakingValidatorInfo | null = null;
        if (this.request.kind === RequestType.SIGN_STAKING) {
            const {
                validatorAddress,
                validatorImageUrl,
                fromValidatorAddress,
                fromValidatorImageUrl,
            } = this.request as ParsedSignStakingRequest;
            validatorInfo = { validatorAddress, validatorImageUrl, fromValidatorAddress, fromValidatorImageUrl };
        } else if (this.request.kind === RequestType.SIGN_TRANSACTION) {
            const signTransactionRequest = this.request as ParsedSignTransactionRequest;
            if (signTransactionRequest.layout === SignTransactionRequestLayout.SWITCH_VALIDATOR
                || signTransactionRequest.layout === SignTransactionRequestLayout.UNSTAKING) {
                const {
                    validatorAddress,
                    validatorImageUrl,
                    fromValidatorAddress,
                    fromValidatorImageUrl,
                } = signTransactionRequest;
                validatorInfo = {
                    validatorAddress: validatorAddress ? validatorAddress.toUserFriendlyAddress() : undefined,
                    validatorImageUrl: validatorImageUrl ? validatorImageUrl.toString() : undefined,
                    fromValidatorAddress: fromValidatorAddress
                        ? fromValidatorAddress.toUserFriendlyAddress()
                        : undefined,
                    fromValidatorImageUrl: fromValidatorImageUrl ? fromValidatorImageUrl.toString() : undefined,
                };
            }
        }
        if (!validatorInfo) return null;

        // Only for update-staker, the sender is rendered as the old validator instead of as the user's address (the
        // actual sender). Don't provide the from-validator info for other transactions, regardless of the request's
        // info, which is not thoroughly validated against the transactions for SIGN_STAKING requests.
        if (this.finalTransaction.toPlain().data.type !== 'update-staker') {
            validatorInfo.fromValidatorAddress = undefined;
            validatorInfo.fromValidatorImageUrl = undefined;
        }
        return validatorInfo;
    }

    /**
     * Whether the UI is reduced to only the LedgerUi, without any transaction details. This is the case for
     * sign-transaction requests with multiple transactions on the standard layout, i.e. arbitrary transactions.
     */
    private get showsTransactionDetails(): boolean {
        return this.request.kind !== RequestType.SIGN_TRANSACTION
            || (this.request as ParsedSignTransactionRequest).layout !== SignTransactionRequestLayout.STANDARD
            || this.transactions.length === 1;
    }

    private get amountAndFee() {
        // Display the value of the final transaction currently, and the fees of all transactions. For requests with a
        // single transaction, this is that transaction's value and fee.
        return {
            amount: Number(this.finalTransaction.value),
            fee: this.transactions.reduce((sum, transaction) => sum + Number(transaction.fee), 0),
        };
    }

    private get transactionData() {
        if (this.request.kind === RequestType.CREATE_CASHLINK) {
            return this.cashlink ? this.cashlink.message : null;
        }

        // Staking transactions of SIGN_STAKING requests and SIGN_TRANSACTION requests.
        const stakingData = this.stakingData;
        if (stakingData) return stakingData;

        // Non-staking transactions. For SIGN_TRANSACTION requests, this is the single transaction of the standard
        // layout.
        const { data, flags } = this.finalTransaction;

        if (!data || data.length === 0) {
            return null;
        }

        // tslint:disable-next-line no-bitwise
        if ((flags & Nimiq.TransactionFlag.ContractCreation) > 0) {
            // TODO: Decode contract creation transactions
            // return ...
        }

        return Utf8Tools.isValidUtf8(data, true)
            ? Utf8Tools.utf8ByteArrayToString(data)
            : Nimiq.BufferUtils.toHex(data);
    }

    private get stakingData() {
        // Staking data for SIGN_STAKING and SIGN_TRANSACTION requests whose final transaction is a staking transaction,
        // e.g. of the switch-validator or unstaking layouts, or a single staking transaction on the standard layout.
        // Display data based on final transaction.
        const finalTransaction = this.finalTransaction;
        const isIncomingStakingTransaction = finalTransaction.recipientType === Nimiq.AccountType.Staking;
        const isOutgoingStakingTransaction = finalTransaction.senderType === Nimiq.AccountType.Staking;
        if (!isIncomingStakingTransaction && !isOutgoingStakingTransaction) return null;
        // Decode the staking data, which is the recipient data for incoming and the sender data for outgoing staking
        // transactions, into its plain form.
        const plainTransaction = finalTransaction.toPlain();
        const { sender, data: recipientData } = plainTransaction;
        // The senderData is typed as optional, but is always set, also for non-staking senders, for which it's raw.
        const senderData = plainTransaction.senderData!;

        if (isIncomingStakingTransaction) {
            switch (recipientData.type) {
                case 'create-staker': {
                    let text = 'Start staking';
                    const { delegation } = recipientData;
                    if (delegation) {
                        text += ` with validator ${delegation}`;
                    } else {
                        text += ' with no validator';
                    }
                    return text;
                }
                case 'update-staker': {
                    let text = 'Change validator';
                    const { newDelegation, reactivateAllStake } = recipientData;
                    if (newDelegation) {
                        text += ` to validator ${newDelegation}`;
                    } else {
                        text += ' to no validator';
                    }
                    if (reactivateAllStake) {
                        text += ' and reactivate all stake';
                    }
                    return text;
                }
                case 'add-stake': {
                    const { staker } = recipientData;
                    return `Add stake to ${staker}`;
                }
                case 'set-active-stake': {
                    const { newActiveBalance } = recipientData;
                    return `Set active stake to ${newActiveBalance / 1e5} NIM`;
                }
                case 'retire-stake': {
                    const { retireStake } = recipientData;
                    return `Retire ${retireStake / 1e5} NIM stake`;
                }
                case 'create-validator': {
                    let text = `Create validator ${sender}`;
                    const { rewardAddress } = recipientData;
                    if (rewardAddress !== sender) {
                        text += ` with reward address ${rewardAddress}`;
                    }
                    // TODO: Somehow let users see validator key, signing key, and signal data that they are signing
                    return text;
                }
                case 'update-validator': {
                    let text = `Update validator ${sender}`;
                    const {
                        newRewardAddress,
                        newVotingKey,
                        newSigningKey,
                        newSignalData,
                    } = recipientData;
                    text += ` ${sender}`;
                    if (newRewardAddress) {
                        text += `, updating reward address to ${newRewardAddress}`;
                    }
                    if (newVotingKey) {
                        text += ', updating voting key';
                    }
                    if (newSigningKey) {
                        text += ', updating signing key';
                    }
                    if (newSignalData) {
                        text += ', updating signal data';
                    }
                    return text;
                }
                case 'deactivate-validator': {
                    const { validator } = recipientData;
                    return `Deactivate validator ${validator}`;
                }
                case 'reactivate-validator': {
                    const { validator } = recipientData;
                    return `Reactivate validator ${validator}`;
                }
                case 'retire-validator': {
                    return `Retire validator ${sender}`;
                }
                default: {
                    return `Unrecognized incoming staking data: ${recipientData.type} - ${recipientData.raw}`;
                }
            }
        } else { // outgoing staking transaction
            switch (senderData.type) {
                case 'remove-stake': {
                    return 'Unstake';
                }
                case 'delete-validator': {
                    // TODO show the validator address here, which is the transaction signer
                    return 'Delete validator';
                }
                default: {
                    return `Unrecognized outgoing staking data: ${senderData.type} - ${senderData.raw}`;
                }
            }
        }
    }

    /**
     * Info about the transaction of a multi-transaction flow that is currently being signed, to be displayed as a step
     * indicator in the LedgerUi.
     */
    private get signingStep(): LedgerUi.SigningStep | null {
        const transactions = this.transactions;
        if (transactions.length <= 1) return null; // not a multi-transaction flow
        const index = Math.min(this.currentlySignedTransactionIndex, transactions.length - 1);
        const transaction = transactions[index];

        // Note that toPlain can throw for invalid transactions, and that this getter is evaluated during rendering and
        // must therefore never throw.
        let stakingDataType: string | undefined;
        try {
            const { data: recipientData, senderData } = transaction.toPlain();
            if (transaction.recipientType === Nimiq.AccountType.Staking) {
                stakingDataType = recipientData.type;
            } else if (transaction.senderType === Nimiq.AccountType.Staking && senderData) {
                stakingDataType = senderData.type;
            }
        } catch (e) {
            stakingDataType = undefined; // fall back to the generic instructions
        }

        // Provide instructions for the known multi-transaction flows.
        let instructions: string;
        switch (stakingDataType) {
            case 'set-active-stake':
                instructions = this.$t('Confirm setting active stake amount') as string;
                break;
            case 'update-staker':
                instructions = this.$t('Confirm update of staking setup') as string;
                break;
            case 'retire-stake':
                instructions = this.$t('Confirm retiring staked NIM') as string;
                break;
            case 'remove-stake':
                instructions = this.$t('Confirm withdrawal of retired NIM') as string;
                break;
            default:
                instructions = this.$t('Confirm Transaction') as string;
        }

        return {
            step: index + 1, // step is 1-based.
            totalSteps: transactions.length,
            instructions,
        };
    }

    private get pageHeaderTitle() {
        switch (this.request.kind) {
            case RequestType.CHECKOUT:
                return this.$t('Verify Payment') as string;
            case RequestType.CREATE_CASHLINK:
                return this.$t('Confirm Cashlink') as string;
            default:
                return this.transactions.length === 1
                    ? this.$t('Confirm Transaction') as string
                    : this.$t('Confirm Transactions') as string;
        }
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
                // Requests for which the Hub sends the transactions itself always consist of only a single transaction.
                return this.request.kind === RequestType.CREATE_CASHLINK
                    ? this.$t('Creating your Cashlink') as string
                    : this.$t('Sending Transaction') as string;
            case SignTransactionLedger.State.FINISHED:
                if (this.isSentByHub) return this.$t('Transaction Sent') as string; // always only one
                return this.transactions.length === 1
                    ? this.$t('Transaction Signed') as string
                    : this.$t('Transactions Signed') as string;
            case SignTransactionLedger.State.EXPIRED:
                return this.$t('The offer expired.') as string;
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
        LedgerApi.disconnect(
            /* cancelRequest */ true,
            /* requestTypeToDisconnect */ LedgerApiRequestType.SIGN_TRANSACTION,
        );
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
    }

    .accounts .account:not(.cashlink) {
        cursor: pointer;
    }

    .accounts .account:not(.cashlink) >>> .identicon {
        transition: transform 0.45s ease;
    }

    .accounts .account:not(.cashlink):hover >>> .identicon {
        transform: scale(1.1);
    }

    .accounts .account.cashlink >>> .label {
        opacity: .5;
        line-height: 1.5;
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
