<template>
<div class="payment-option" :id="paymentOptions.currency">
    <CurrencyInfo v-if="request.paymentOptions.length > 1"
        :currency="paymentOptions.currency"
        :fiatCurrency="request.fiatCurrency"
        :fiatFeeAmount="paymentOptions.fiatFee(request.fiatAmount)"
        />
    <SmallPage>
        <StatusScreen
            :title="title"
            :status="status"
            :state="state"
            :message="message"
            v-if="showStatusScreen"
            @main-action="() => this.backToShop()"
            mainAction="Go back to shop"/>
        <template v-if="rpcState">
            <PaymentInfoLine
                ref="info"
                :cryptoAmount="{
                    amount: paymentOptions.amount,
                    currency: paymentOptions.currency,
                    decimals: paymentOptions.decimals,
                }"
                :fiatAmount="request.fiatAmount && request.fiatCurrency ? {
                    amount: request.fiatAmount,
                    currency: request.fiatCurrency,
                } : null"
                :address="paymentOptions.protocolSpecific.recipient
                    ? paymentOptions.protocolSpecific.recipient.toUserFriendlyAddress()
                    : null"
                :origin="rpcState.origin"
                :shopLogoUrl="request.shopLogoUrl"
                :startTime="request.time"
                :endTime="paymentOptions.expires" />
        </template>
        <template v-if="wallets.length === 0">
            <h2 class="nq-h1">With Nimiq, it gets better</h2>
            <!-- TODO -->
        </template>
        <template v-else>
            <h2 class="nq-h1">Choose an Address to pay</h2>
            <div v-if="!balancesUpdating && !hasSufficientBalanceAccount" class="non-sufficient-balance">
                <p class="nq-text nq-orange">None of your Addresses has sufficient balance.</p>
                <a class="nq-button-s nq-light-blue-bg" href="https://nimiq.com/#exchanges" target="_blank">
                    <TransferIcon/> Get NIM&nbsp;
                </a>
            </div>
            <AccountSelector
                :wallets="processedWallets"
                :minBalance="balancesUpdating ? 0 : paymentOptions.total"
                @account-selected="setAccountOrContract"
                @login="() => goToOnboarding(false)"/>
        </template>
    </SmallPage>
    <Network ref="network" :visible="false" @head-change="onHeadChange"/>
</div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { State, Mutation, Getter } from 'vuex-class';
import KeyguardClient from '@nimiq/keyguard-client';
import { State as RpcState } from '@nimiq/rpc';
import { AccountSelector, PaymentInfoLine, SmallPage, TransferIcon } from '@nimiq/vue-components';
import { AccountInfo } from '../lib/AccountInfo';
import {
    TX_VALIDITY_WINDOW,
    LEGACY_GROUPING_ACCOUNT_ID,
    LEGACY_GROUPING_ACCOUNT_LABEL,
    ERROR_CANCELED,
} from '../lib/Constants';
import { ContractInfo, VestingContractInfo } from '../lib/ContractInfo';
import { Account, Currency, RequestType } from '../lib/PublicRequestTypes';
import staticStore, { Static } from '../lib/StaticStore';
import { WalletInfo, WalletType } from '../lib/WalletInfo';
import { WalletStore } from '../lib/WalletStore';
import { NimiqDirectPaymentOptions, ParsedNimiqDirectPaymentOptions } from '../lib/paymentOptions/NimiqPaymentOptions';
import Network from './Network.vue';
import StatusScreen from './StatusScreen.vue';
import CheckoutOption from './CheckoutOption.vue';
import CurrencyInfo from './CurrencyInfo.vue';

@Component({components: {
    AccountSelector,
    CurrencyInfo,
    Network,
    SmallPage,
    StatusScreen,
    PaymentInfoLine,
    TransferIcon,
}})
export default class NimiqCheckoutOption
    extends CheckoutOption<ParsedNimiqDirectPaymentOptions> {
    private static readonly BALANCE_CHECK_STORAGE_KEY = 'nimiq_checkout_last_balance_check';
    @State private wallets!: WalletInfo[];

    @Getter private processedWallets!: WalletInfo[];
    @Getter private findWalletByAddress!: (address: string, includeContracts: boolean) => WalletInfo | undefined;

    @Mutation('addWallet') private $addWallet!: (walletInfo: WalletInfo) => any;
    @Mutation('setActiveAccount') private $setActiveAccount!: (payload: {
        walletId: string,
        userFriendlyAddress: string,
    }) => any;

    private updateBalancePromise: Promise<void> | null = null;
    private balancesUpdating: boolean = true;
    private height: number = 0;

    private created() {
        if (this.paymentOptions.currency !== Currency.NIM) {
            throw new Error('NimiqCheckoutOption did not get a NimiqPaymentOption.');
        }
    }

    private async mounted() {
        if (this.paymentOptions.expires) {
            this.fetchTime().then((referenceTime) => {
                if (referenceTime) {
                    if (this.$refs.info) {
                        (this.$refs.info as PaymentInfoLine).setTime(referenceTime);
                    }
                    this.setupTimeout(referenceTime);
                }
            });
        }
        // Requires Network child component to be rendered
        this.addConsensusListeners();
        this.updateBalancePromise = this.getBalances().then((balances) => {
            this.balancesUpdating = false;
        });

        if (this.request.paymentOptions.length === 1) {
            if (this.paymentOptions.protocolSpecific.sender) {
                // Handle optional sender address included in the request
                // Check if the address exists
                const senderAddress = this.paymentOptions.protocolSpecific.sender.toUserFriendlyAddress();
                const wallet = this.findWalletByAddress(senderAddress, true);
                if (wallet) {
                    // Forward to Keyguard, skipping account selection
                    this.setAccountOrContract(
                        wallet.id,
                        senderAddress,
                        true);
                } else if (this.paymentOptions.protocolSpecific.forceSender) {
                    this.$rpc.reject(new Error('Address not found'));
                }
            }
        }
    }

    private async getBalances(): Promise<Map<string, number>> {
        const cache = this.getLastBalanceUpdateHeight();
        const isRefresh = !window.performance || performance.navigation.type === 1;

        const sideResultAddedWallet = !!staticStore.sideResult && !!(staticStore.sideResult as Account[]).length;
        if (!sideResultAddedWallet && cache && !isRefresh) {
            this.onHeadChange(cache);
            return cache.balances;
        }

        // Copy wallets to be able to manipulate them
        const wallets = this.wallets.slice(0);

        // Generate a new array with references to the respective wallets' accounts
        const accountsAndContracts = wallets.reduce((acc, wallet) => {
            acc.push(...wallet.accounts.values());
            acc.push(...wallet.contracts);
            return acc;
        }, [] as Array<AccountInfo | ContractInfo>);

        // Reduce userfriendly addresses from that
        const addresses = accountsAndContracts.map((accountOrContract) => accountOrContract.userFriendlyAddress);

        // Get balances through pico consensus, also triggers head-change event
        const network = (this.$refs.network as Network);
        const balances: Map<string, number> = await network.getBalances(addresses);

        // Update accounts/contracts with their balances
        // (The accounts are still references to themselves in the wallets' accounts maps)
        for (const accountOrContract of accountsAndContracts) {
            const balance = balances.get(accountOrContract.userFriendlyAddress);
            if (balance === undefined) continue;

            if ('type' in accountOrContract && accountOrContract.type === Nimiq.Account.Type.VESTING) {
                // Calculate available amount for vesting contract
                accountOrContract.balance = (accountOrContract as VestingContractInfo)
                    .calculateAvailableAmount(this.height, Nimiq.Policy.coinsToSatoshis(balance));
            } else {
                accountOrContract.balance = Nimiq.Policy.coinsToSatoshis(balance);
            }
        }

        // Store updated wallets
        for (const wallet of wallets) {
            // Update IndexedDB
            await WalletStore.Instance.put(wallet);

            // Update Vuex
            this.$addWallet(wallet);
        }

        // Cache height and balances
        const cacheInput = {
            timestamp: Date.now(),
            height: this.height,
            balances: Array.from(balances.entries()),
        };
        window.sessionStorage.setItem(NimiqCheckoutOption.BALANCE_CHECK_STORAGE_KEY, JSON.stringify(cacheInput));

        return balances;
    }

    private onHeadChange(head: Nimiq.BlockHeader | {height: number}) {
        this.height = head.height;
    }

    private addConsensusListeners() {
        const network = (this.$refs.network as Network);
        network.$on(Network.Events.API_READY, () => this.status = 'Contacting seed nodes...');
        network.$on(Network.Events.CONSENSUS_SYNCING, () => this.status = 'Syncing consensus...');
        network.$on(Network.Events.CONSENSUS_ESTABLISHED, () => this.status = 'Requesting balances...');
    }

    private async setAccountOrContract(walletId: string, address: string, isFromRequest = false) {
        if (this.request.callbackUrl) {
            await this.fetchPaymentOption();
        }
        this.$emit('chosen', this.paymentOptions.currency);

        if (this.balancesUpdating) {
            this.showStatusScreen = true;
            await this.updateBalancePromise;
        }
        const nimiqAddress = Nimiq.Address.fromUserFriendlyAddress(address);
        const senderAccount = this.wallets.find((wallet: WalletInfo) => wallet.id === walletId)!;
        const senderContract = senderAccount.findContractByAddress(nimiqAddress);
        const signer = senderAccount.findSignerForAddress(nimiqAddress)!;

        if ((senderContract && senderContract.balance! < this.paymentOptions.total)
            || senderAccount && senderAccount.accounts.get(address)!.balance! < this.paymentOptions.total) {
            if (this.paymentOptions.protocolSpecific.forceSender) {
                this.$rpc.reject(new Error('Insufficient balance'));
                return;
            } else {
                this.showStatusScreen = false;
                return;
            }
        }

        // FIXME: Also handle active account we get from store
        this.$setActiveAccount({
            walletId: senderAccount.id,
            userFriendlyAddress: (senderContract || signer).userFriendlyAddress,
        });

        // proceed to transaction signing
        switch (senderAccount.type) {
            case WalletType.LEDGER:
                if (!this.paymentOptions.protocolSpecific.recipient) {
                    await this.fetchPaymentOption();
                }
                this.showStatusScreen = false;
                this.$rpc.routerPush(`${RequestType.SIGN_TRANSACTION}-ledger`);
                return;
            case WalletType.LEGACY:
            case WalletType.BIP39:
                if (!this.height) return;

                // The next block is the earliest for which tx are accepted by standard miners
                const validityStartHeight = this.height + 1
                    - TX_VALIDITY_WINDOW
                    + (this.paymentOptions.protocolSpecific.validityDuration
                        ? this.paymentOptions.protocolSpecific.validityDuration
                        : TX_VALIDITY_WINDOW);

                if (!this.paymentOptions.protocolSpecific.recipient) {
                    await this.fetchPaymentOption();
                }

                const request: KeyguardClient.SignTransactionRequest = {
                    layout: 'checkout',
                    shopOrigin: this.rpcState.origin,
                    appName: this.request.appName,
                    shopLogoUrl: this.request.shopLogoUrl,

                    keyId: senderAccount.keyId,
                    keyPath: signer!.path,
                    keyLabel: senderAccount.label,

                    sender: (senderContract || signer).address.serialize(),
                    senderType: senderContract ? senderContract.type : Nimiq.Account.Type.BASIC,
                    senderLabel: (senderContract || signer).label,
                    recipient: this.paymentOptions.protocolSpecific.recipient!.serialize(),
                    recipientType: this.paymentOptions.protocolSpecific.recipientType,
                    // recipientLabel: '', // Checkout is using the shopOrigin instead
                    value: this.paymentOptions.amount,
                    fee: this.paymentOptions.protocolSpecific.fee || 0,
                    validityStartHeight,
                    data: this.request.data,
                    flags: this.paymentOptions.protocolSpecific.flags,

                    fiatAmount: this.request.fiatAmount,
                    fiatCurrency: this.request.fiatCurrency,
                    time: this.request.time, // TODO convert times from server time to local time
                    expires: this.paymentOptions.expires,
                };

                staticStore.keyguardRequest = request;
                const client = this.$rpc.createKeyguardClient(isFromRequest);
                client.signTransaction(request);
                return;
        }
    }

    private goToOnboarding(useReplace?: boolean) {
        // Redirect to onboarding
        staticStore.originalRouteName = RequestType.CHECKOUT;
        if (useReplace) {
            this.$rpc.routerReplace(RequestType.ONBOARD);
        } else {
            this.$rpc.routerPush(RequestType.ONBOARD);
        }
    }

    private get hasSufficientBalanceAccount(): boolean {
        return this.wallets.some((wallet: WalletInfo) => [...wallet.accounts.values(), ...wallet.contracts]
            .some((info: AccountInfo | ContractInfo) => !!info.balance && info.balance >= this.paymentOptions.total));
    }

    private getLastBalanceUpdateHeight(): {timestamp: number, height: number, balances: Map<string, number>} | null {
        const rawCache = window.sessionStorage.getItem(NimiqCheckoutOption.BALANCE_CHECK_STORAGE_KEY);
        if (!rawCache) return null;

        try {
            const cache: {timestamp: number, height: number, balances: Array<[string, number]>} = JSON.parse(rawCache);

            // Check if expired or doesn't have a height
            if (cache.timestamp < Date.now() - 5 * 60 * 1000 || cache.height === 0) throw new Error();

            return Object.assign(cache, {
                balances: new Map(cache.balances),
            });
        } catch (e) {
            window.sessionStorage.removeItem(NimiqCheckoutOption.BALANCE_CHECK_STORAGE_KEY);
            return null;
        }
    }
}
</script>

<style scoped>
    .small-page {
        position: relative;
    }

    .status-screen {
        position: absolute;
        left: 0;
        top: 0;
    }

    .nq-h1 {
        margin-top: 3.5rem;
        margin-bottom: 1rem;
        line-height: 1;
        text-align: center;
    }

    a.nq-button {
        line-height: 7.5rem;
    }

    .non-sufficient-balance {
        text-align: center;
        margin-top: 0.5rem;
        margin-bottom: 0.5rem;
        flex-shrink: 0;
    }

    .non-sufficient-balance .nq-text {
        opacity: 1;
        font-weight: 600;
    }

    .non-sufficient-balance .nq-button-s {
        color: white;
        line-height: 3.375rem;
    }

    .non-sufficient-balance .nq-icon {
        font-size: 2.25rem;
        vertical-align: text-bottom;
    }
</style>
