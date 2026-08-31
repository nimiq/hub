<template>
    <div v-if="request.kind === 'create-cashlink' ? !!cashlink : true" class="container">
        <SmallPage :class="{ 'account-details-shown': !!shownAccountDetails }">
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
                {{
                    request.kind === 'checkout'
                        ? $t('Verify Payment')
                        : request.kind === 'create-cashlink'
                            ? $t('Confirm Cashlink')
                            : $t('Confirm Transaction')
                }}
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
    CASHLINK_FUNDING_DATA,
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

interface AccountDetailsData {
    address: string;
    label?: string;
    image?: string;
    walletLabel?: string;
    balance?: number;
    isCashlink?: boolean;
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
    private _checkoutExpiryTimeout: number = -1;

    private async mounted() {
        if (this.request.kind === RequestType.SIGN_TRANSACTION) {
            const signTransactionRequest = this.request as ParsedSignTransactionRequest;
            if (signTransactionRequest.layout === SignTransactionRequestLayout.STANDARD
                && signTransactionRequest.transactions.length > 1) {
                // Multi-transaction requests with the standard layout are not supported for Ledger accounts yet. The
                // staking layouts (switch-validator, unstaking), whose transaction counts are fixed by the request
                // parsing, are supported and rendered like SIGN_STAKING requests, see stakingValidatorInfo.
                this.$rpc.reject(new Error('Multi-transaction sign-transaction requests with the standard layout are '
                    + 'not yet supported for Ledger accounts'));
                return;
            }
        }

        const network = this.$refs.network as Network;
        if (this.request.kind === RequestType.CHECKOUT || this.request.kind === RequestType.CREATE_CASHLINK) {
            // Pre-connect to network when we know we'll need it. Does not need to be awaited, as the methods on network
            // that actually need to be connected, themselves ensure to be connected.
            network.getNetworkClient().catch(() => {}); // tslint:disable-line no-empty
        }

        // If user left this view in the meantime, don't continue
        if (this.isDestroyed) return;

        this.senderDetails = {
            address: '',
            label: 'senderLabel' in this.request ? this.request.senderLabel : undefined,
        };

        // The request's transactions to sign and display, for SIGN_TRANSACTION and SIGN_STAKING requests.
        const transactions = this.transactions;

        // Collect payment information
        let sender: Nimiq.Address;
        let recipient: Nimiq.Address;
        let value: number;
        let fee: number;
        let validityStartHeightPromise: Promise<number> | undefined;
        let recipientData: Uint8Array | undefined;
        let flags: number;
        if (this.request.kind === RequestType.SIGN_TRANSACTION) {
            // Direct sign transaction request invocation
            const signTransactionRequest = this.request as ParsedSignTransactionRequest;
            sender = signTransactionRequest.sender instanceof Nimiq.Address
                ? signTransactionRequest.sender
                : signTransactionRequest.sender.address;

            // The legacy single-transaction request format does not support specifying the senderType, in which case
            // it is determined from the WalletStore.
            let storeSenderType = Nimiq.AccountType.Basic;
            if (!(signTransactionRequest.sender instanceof Nimiq.Address)) {
                storeSenderType = signTransactionRequest.sender.type || Nimiq.AccountType.Basic;
            } else {
                // existence checked in RpcApi
                const senderContract = this.findWalletByAddress(sender.toUserFriendlyAddress(), true)!
                    .findContractByAddress(sender);
                if (senderContract) storeSenderType = senderContract.type;
            }
            patchLegacyRequestSenderType(signTransactionRequest, storeSenderType);

            // Set other values only for correct type checking. They won't be used for request type SIGN_TRANSACTION.
            recipient = sender;
            value = fee = flags = Number.NaN;

            if (signTransactionRequest.layout === SignTransactionRequestLayout.STANDARD) {
                // Standard layout with a single transaction (multiple transactions are rejected above). The staking
                // layouts are rendered based on their final transaction in the shared staking flow block below.
                const [transaction] = signTransactionRequest.transactions;
                this.senderDetails.address = transaction.sender.toUserFriendlyAddress(); // might be not the user
                this.recipientDetails = {
                    address: transaction.recipient.toUserFriendlyAddress(),
                    label: signTransactionRequest.recipientLabel,
                };
            }
        } else if (this.request.kind === RequestType.SIGN_STAKING) {
            // Direct sign staking request invocation
            // Display the transaction info based on the final transaction.
            const finalTransaction = transactions![transactions!.length - 1];
            sender = finalTransaction.sender;

            // Set other values only for correct type checking. They won't be used for request type SIGN_STAKING as the
            // transactions to sign are built from the request's transactions directly, see transactions.
            recipient = sender;
            value = fee = flags = Number.NaN;

            // The account details are rendered in the shared staking flow block below.
        } else if (this.request.kind === RequestType.CHECKOUT) {
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
                } catch (e) {
                    this.$rpc.reject(e);
                    return;
                }
            }
            if (!checkoutPaymentOptions.protocolSpecific.recipient) {
                this.$rpc.reject(new Error('Failed to fetch checkout recipient.'));
                return;
            }

            sender = Nimiq.Address.fromString(this.$store.state.activeUserFriendlyAddress);
            ({ amount: value, fee } = checkoutPaymentOptions);
            ({ recipient, flags, extraData: recipientData } = checkoutPaymentOptions.protocolSpecific);

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

            // Synchronize time in background
            if (checkoutPaymentOptions.expires) {
                this._initializeCheckoutExpiryTimer().catch((e) => this.$rpc.reject(e));
            }
        } else if (this.request.kind === RequestType.CREATE_CASHLINK) {
            // Coming from cashlink create
            if (!this.cashlink) {
                this.$rpc.reject( new Error('Ledger Cashlink Signing expects the Cashlink to sign to be in the '
                    + 'static store.'));
                return;
            }
            sender = Nimiq.Address.fromString(this.$store.state.activeUserFriendlyAddress);
            ({ recipient, value, fee } = this.cashlink!.getFundingDetails());
            validityStartHeightPromise = network.getBlockchainHeight().then((blockchainHeight) => blockchainHeight + 1);
            recipientData = CASHLINK_FUNDING_DATA;
            flags = Nimiq.TransactionFlag.None;

            this.recipientDetails = {
                address: this.cashlink.address.toUserFriendlyAddress(),
                label: this.$t('New Cashlink') as string,
                isCashlink: true,
            };
        } else if (history.length >= 3) {
            // First history entry is root, the second an original request handler invoking the transaction signing
            // and the third is this one. If there was an original request handler calling us but the intermediate
            // transaction signing request was lost on reload and instead the original request recovered from the
            // RPC state, navigate back to the original request handler.
            // TODO implementing a proper request call stack instead of the originalRouteName hack would avoid this
            history.back();
            return;
        } else {
            this.$rpc.reject(new Error('Legder Transaction Signing must be invoked via sign-transaction, sign-staking,'
                + 'checkout or cashlink requests.'));
            return;
        }

        // Staking flows (SIGN_STAKING requests, and SIGN_TRANSACTION requests with a staking layout) are displayed
        // based on their validator info, see stakingValidatorInfo. Only the info to be displayed is extracted here,
        // not the info to create the transactions, which are built from the requests' transactions directly in the
        // transactions getter.
        const stakingValidatorInfo = this.stakingValidatorInfo;
        if (stakingValidatorInfo) {
            const finalTransaction = transactions![transactions!.length - 1];
            this.senderDetails.address = finalTransaction.sender.toUserFriendlyAddress(); // might be not the user
            this.recipientDetails = {
                address: finalTransaction.recipient.toUserFriendlyAddress(),
                label: (this.request as ParsedSignStakingRequest | ParsedSignTransactionRequest).recipientLabel,
            };

            // Render the staking contract as the validator that is being staked with.
            const stakingContractDetails = finalTransaction.senderType === Nimiq.AccountType.Staking
                ? this.senderDetails
                : this.recipientDetails;
            stakingContractDetails.address = stakingValidatorInfo.validatorAddress || stakingContractDetails.address;
            stakingContractDetails.image = stakingValidatorInfo.validatorImageUrl;

            // For update-staker, render the sender as the old validator instead of as the user's address (the actual
            // sender), see stakingValidatorInfo.
            this.senderDetails.address = stakingValidatorInfo.fromValidatorAddress || this.senderDetails.address;
            this.senderDetails.image = stakingValidatorInfo.fromValidatorImageUrl || this.senderDetails.image;
        }

        this.senderDetails.address = this.senderDetails.address || sender.toUserFriendlyAddress();

        // Find signer key and refine labels based on signer info.
        let signerKeyId: string;
        let signerKeyPath: string;
        let senderType: Nimiq.AccountType | undefined;
        if ('sender' in this.request && !(this.request.sender instanceof Nimiq.Address)) {
            // It's a sign transaction request with sender info object.
            // Note that the sender object is currently only for internal use in RefundSwapLedger.
            ({
                type: senderType,
                signerKeyId,
                signerKeyPath,
            } = this.request.sender);

            this.senderDetails.label = this.senderDetails.label || this.request.sender.label;
            this.senderDetails.walletLabel = this.senderDetails.walletLabel || this.request.sender.walletLabel;
        } else {
            let userAddress: Nimiq.Address; // might be a regular address or a contract address
            if (this.request.kind === RequestType.SIGN_STAKING) {
                // For staking, the sender or recipient address might be the user's address, and there is no request-
                // level sender that the parser already parses this information to.
                const finalTransaction = transactions![transactions!.length - 1];
                userAddress = finalTransaction.senderType === Nimiq.AccountType.Basic
                    ? finalTransaction.sender
                    : finalTransaction.recipient;
                // No need to set senderType, as we're not using it for SIGN_STAKING requests.
            } else {
                // For SIGN_TRANSACTION the request-level sender is the user's address for all layouts, as the request
                // parsing binds basic and contract senders to it, and outgoing staking transactions, e.g. remove-stake
                // of the multi-tx unstaking layout, to pay out to it, see parseSignTransactionRequest.
                userAddress = sender;
            }

            // We know that these exist as their existence was already checked in RpcApi.ts
            const userAccount = this.findWalletByAddress(userAddress.toUserFriendlyAddress(), true)!;
            const userAccountContract = userAccount.findContractByAddress(userAddress);
            const userAccountSigner = userAccount.findSignerForAddress(userAddress)!;

            signerKeyId = userAccount.keyId;
            signerKeyPath = userAccountSigner.path;
            senderType = sender.equals(userAddress) && userAccountContract
                ? userAccountContract.type
                : Nimiq.AccountType.Basic;

            // In the UI, the user can represent the sender (typical case), recipient (for unstaking) or none of those
            // (for update-staker / switch-validator). If one of those is rendered as the user details, enrich them with
            // the wallet label and balance.
            const userAddressDetails = [this.senderDetails, this.recipientDetails]
                .find(({ address }) => address === userAddress.toUserFriendlyAddress());
            if (userAddressDetails) {
                // The label of the user's own address always comes from the user's account data, overwriting a
                // requested label, which a caller must not be able to set for it.
                userAddressDetails.label = (userAccountContract || userAccountSigner).label;
                userAddressDetails.walletLabel = userAddressDetails.walletLabel || userAccount.label;
                userAddressDetails.balance = userAddressDetails.balance
                    || (userAccountContract || userAccountSigner).balance;
            }
        }

        // Collect transaction infos to pass to LedgerApi
        const transactionInfos: Array<Omit<
            LedgerApiTransactionInfoNimiq<typeof Config.ledgerApiNimiqVersion>,
            'senderType' | 'recipientType' | 'validityStartHeight'
        > & {
            senderType?: Nimiq.AccountType,
            recipientType?: Nimiq.AccountType,
            validityStartHeight?: number,
        }> = [];
        if (transactions) { // SIGN_TRANSACTION or SIGN_STAKING request
            const propertiesToCopy = [
                'sender',
                'senderType',
                'senderData',
                'recipient',
                'recipientType',
                'value',
                'fee',
                'validityStartHeight',
                'flags',
            ] as const;
            for (const transaction of transactions) {
                transactionInfos.push({
                    ...(propertiesToCopy.reduce((transactionInfo, property) => ({
                        ...transactionInfo,
                        [property]: transaction[property],
                    }), {} as Pick<Nimiq.Transaction, (typeof propertiesToCopy)[number]>)),
                    recipientData: transaction.data,
                    network: Config.network as LedgerApiNetwork, // enforce configured network
                });
            }
        } else {
            transactionInfos.push({
                sender,
                senderType,
                recipient,
                value: BigInt(value),
                fee: BigInt(fee || 0),
                network: Config.network as LedgerApiNetwork,
                recipientData,
                flags,
            });
        }

        // Sign transactions, and send to network, depending on the request type.
        const signedTransactions: SignedTransaction[] = [];
        for (const transactionInfo of transactionInfos) {
            // If user left this view in the meantime, don't continue signing / sending the transactions
            if (this.isDestroyed) return;

            // Check whether transaction was already signed but not successfully sent before user reloaded the page.
            let signedTransaction = network.getUnrelayedTransactions({
                ...transactionInfo,
                data: transactionInfo.recipientData,
            })[0];
            if (!signedTransaction) {
                let validityStartHeight = transactionInfo.validityStartHeight;
                if (validityStartHeight === undefined) {
                    try {
                        if (!validityStartHeightPromise) throw new Error('Unexpected: no validityStartHeight');
                        validityStartHeight = await validityStartHeightPromise;
                    } catch (e) {
                        if (this.isDestroyed) return; // user is not on this view anymore
                        this.$rpc.reject(e);
                        return;
                    }
                }

                try {
                    signedTransaction = await LedgerApi.Nimiq.signTransaction(
                        {
                            ...transactionInfo,
                            senderType: transactionInfo.senderType as LedgerApiAccountTypeNimiq | undefined,
                            recipientType: transactionInfo.recipientType as LedgerApiAccountTypeNimiq | undefined,
                            validityStartHeight,
                        },
                        signerKeyPath,
                        signerKeyId,
                        Config.ledgerApiNimiqVersion,
                    );
                } catch (e) {
                    if (this.isDestroyed) return; // user is not on this view anymore
                    // If cancelled and not expired, handle the exception. Otherwise, just keep the ledger ui / expiry
                    // error message displayed.
                    if (this.state !== SignTransactionLedger.State.EXPIRED
                        && e.message.toLowerCase().indexOf('cancelled') !== -1) {
                        const isCheckoutRequestWithManuallySelectedAddress = this.request.kind === RequestType.CHECKOUT
                            && (
                                !this.checkoutPaymentOptions!.protocolSpecific.sender
                                || !sender.equals(this.checkoutPaymentOptions!.protocolSpecific.sender)
                            );

                        if (isCheckoutRequestWithManuallySelectedAddress
                            || this.request.kind === RequestType.CREATE_CASHLINK) {
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
            if (this.request.kind === RequestType.CHECKOUT || this.request.kind === RequestType.CREATE_CASHLINK) {
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

        if (this.request.kind !== RequestType.CREATE_CASHLINK) {
            this.state = SignTransactionLedger.State.FINISHED;
            await new Promise((resolve) => setTimeout(resolve, StatusScreen.SUCCESS_REDIRECT_DELAY));
            // For SIGN_TRANSACTION, return a single result iff a single transaction was signed (same rule as in
            // the Keyguard); SIGN_STAKING always returns an array
            const result = this.request.kind !== RequestType.SIGN_STAKING && signedTransactions.length === 1
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

    private get checkoutPaymentOptions() {
        if (this.request.kind !== RequestType.CHECKOUT) return null;
        const checkoutRequest = this.request as ParsedCheckoutRequest;
        return checkoutRequest.paymentOptions.find(
            (option) => option.currency === Currency.NIM,
        ) as ParsedNimiqDirectPaymentOptions;
    }

    /**
     * The request's transactions to sign and display, for SIGN_TRANSACTION and SIGN_STAKING requests. Null for other
     * request types.
     */
    private get transactions(): Nimiq.Transaction[] | null {
        switch (this.request.kind) {
            case RequestType.SIGN_TRANSACTION:
                return (this.request as ParsedSignTransactionRequest).transactions;
            case RequestType.SIGN_STAKING:
                return (this.request as ParsedSignStakingRequest).transactions
                    .map((plainTransaction) => Nimiq.Transaction.fromPlain(plainTransaction));
            default:
                return null;
        }
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
        const transactions = this.transactions!;
        const finalTransaction = transactions[transactions.length - 1];
        if (finalTransaction.toPlain().data.type !== 'update-staker') {
            validatorInfo.fromValidatorAddress = undefined;
            validatorInfo.fromValidatorImageUrl = undefined;
        }
        return validatorInfo;
    }

    private get amountAndFee() {
        let amount: number;
        let fee: number;
        if (this.checkoutPaymentOptions) {
            ({ amount, fee } = this.checkoutPaymentOptions);
        } else if (this.cashlink) {
            ({ value: amount, fee } = this.cashlink);
        } else { // SIGN_TRANSACTION or SIGN_STAKING request
            // Display the value of the final transaction, and the fees of all transactions. For a standard layout
            // SIGN_TRANSACTION request, this is the single transaction's value and fee.
            const transactions = this.transactions!;
            const finalTransaction = transactions[transactions.length - 1];
            amount = Number(finalTransaction.value);
            fee = transactions.reduce((sum, transaction) => sum + Number(transaction.fee), 0);
        }
        return { amount, fee };
    }

    private get transactionData() {
        if (this.request.kind === RequestType.CREATE_CASHLINK) {
            return this.cashlink ? this.cashlink.message : null;
        }

        // Staking transactions of SIGN_STAKING requests and SIGN_TRANSACTION requests.
        const stakingData = this.stakingData;
        if (stakingData) return stakingData;

        let data;
        let flags;
        if (this.request.kind === RequestType.SIGN_TRANSACTION) {
            // Standard layout with a single, non-staking transaction. Multiple transactions are rejected in mounted(),
            // and staking transactions, including the staking layouts, are handled via stakingData above.
            const [transaction] = (this.request as ParsedSignTransactionRequest).transactions;
            data = transaction.data;
            flags = transaction.flags;
        } else if (this.request.kind === RequestType.CHECKOUT) {
            ({ extraData: data, flags } = this.checkoutPaymentOptions!.protocolSpecific);
        } else { // SIGN_STAKING request without staking info; not expected to happen
            return null;
        }

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
        const transactions = this.transactions;
        if (!transactions) return null;
        // Display data based on final transaction.
        const finalTransaction = transactions[transactions.length - 1];
        const isIncomingStakingTransaction = finalTransaction.recipientType === Nimiq.AccountType.Staking;
        const isOutgoingStakingTransaction = finalTransaction.senderType === Nimiq.AccountType.Staking;
        if (!isIncomingStakingTransaction && !isOutgoingStakingTransaction) return null;
        // Decode the staking data, which is the recipient data for incoming and the sender data for outgoing staking
        // transactions, into its plain form.
        const { sender, senderData, data: recipientData } = finalTransaction.toPlain();

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
            // @ts-ignore Missmatch with Nimiq.PlainTransactionDetails from fastspot-api
            switch (senderData.type) {
                case 'remove-stake': {
                    return 'Unstake';
                }
                case 'delete-validator': {
                    // TODO show the validator address here, which is the transaction signer
                    return 'Delete validator';
                }
                default: {
                    // @ts-ignore Missmatch with Nimiq.PlainTransactionDetails from fastspot-api
                    return `Unrecognized outgoing staking data: ${senderData.type} - ${senderData.raw}`;
                }
            }
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
                return this.request.kind === RequestType.CREATE_CASHLINK
                    ? this.$t('Creating your Cashlink') as string
                    : this.$t('Sending Transaction') as string;
            case SignTransactionLedger.State.FINISHED:
                return this.request.kind === RequestType.SIGN_TRANSACTION
                    ? this.$t('Transaction Signed') as string
                    : this.$t('Transaction Sent') as string;
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
