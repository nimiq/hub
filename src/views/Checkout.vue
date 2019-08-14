<template>
    <div class="container">
        <SmallPage v-if="height === 0 || !hasBalances">
            <StatusScreen title="Updating your balances" :status="status"/>
        </SmallPage>

        <SmallPage v-else :class="{ 'merchant-info-shown': showMerchantInfo }">
            <PaymentInfoLine v-if="rpcState"
                :amount="request.value"
                :fee="request.fee"
                :address="request.recipient.toUserFriendlyAddress()"
                :origin="rpcState.origin"
                :shopLogoUrl="request.shopLogoUrl"
                @merchant-info-clicked="showMerchantInfo = true"
            />

            <h1 class="nq-h1">Choose an Address to pay</h1>

            <div v-if="!hasSufficientBalanceAccount" class="non-sufficient-balance">
                <p class="nq-text nq-orange">None of your Addresses has sufficient balance.</p>
                <a class="nq-button-s nq-light-blue-bg" href="https://nimiq.com/#exchanges" target="_blank">
                    <TransferIcon/> Get NIM&nbsp;
                </a>
            </div>

            <AccountSelector
                :wallets="processedWallets"
                :minBalance="minBalance"
                @account-selected="setAccountOrContract"
                @login="() => goToOnboarding(false)"/>

            <transition name="account-details-fade">
                <AccountDetails
                    v-if="showMerchantInfo"
                    :address="request.recipient.toUserFriendlyAddress()"
                    :label="shopOrigin"
                    :image="request.shopLogoUrl"
                    @close="showMerchantInfo = false"
                />
            </transition>
        </SmallPage>

        <button class="global-close nq-button-s" @click="close">
            <ArrowLeftSmallIcon/>
            Cancel Payment
        </button>

        <Network ref="network" :visible="false" @head-change="onHeadChange"/>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { PaymentInfoLine, AccountSelector, AccountDetails, SmallPage } from '@nimiq/vue-components';
import { TransferIcon, ArrowLeftSmallIcon } from '@nimiq/vue-components';
import { ParsedCheckoutRequest, RequestType } from '../lib/RequestTypes';
import { Account } from '../lib/PublicRequestTypes';
import { State as RpcState } from '@nimiq/rpc';
import staticStore, { Static } from '../lib/StaticStore';
import { WalletStore } from '../lib/WalletStore';
import { AccountInfo } from '../lib/AccountInfo';
import { WalletInfo, WalletType } from '../lib/WalletInfo';
import { State, Mutation, Getter } from 'vuex-class';
import {
    TX_VALIDITY_WINDOW,
    LEGACY_GROUPING_ACCOUNT_ID,
    LEGACY_GROUPING_ACCOUNT_LABEL,
    ERROR_CANCELED,
} from '../lib/Constants';
import Network from '../components/Network.vue';
import StatusScreen from '../components/StatusScreen.vue';
import KeyguardClient from '@nimiq/keyguard-client';
import { ContractInfo, VestingContractInfo } from '../lib/ContractInfo';

@Component({components: {
    PaymentInfoLine,
    AccountSelector,
    AccountDetails,
    SmallPage,
    Network,
    StatusScreen,
    TransferIcon,
    ArrowLeftSmallIcon,
}})
export default class Checkout extends Vue {
    private static readonly BALANCE_CHECK_STORAGE_KEY = 'nimiq_checkout_last_balance_check';

    @Static private rpcState!: RpcState;
    @Static private request!: ParsedCheckoutRequest;
    @State private wallets!: WalletInfo[];

    @Getter private processedWallets!: WalletInfo[];
    @Getter private findWalletByAddress!: (address: string, includeContracts: boolean) => WalletInfo | undefined;

    @Mutation('addWallet') private $addWallet!: (walletInfo: WalletInfo) => any;
    @Mutation('setActiveAccount') private $setActiveAccount!: (payload: {
        walletId: string,
        userFriendlyAddress: string,
    }) => any;

    private showMerchantInfo: boolean = false;
    private height: number = 0;
    private hasBalances: boolean = false;
    private status: string = 'Connecting to network...';

    private async created() {
        const $subtitle = document.querySelector('.logo .logo-subtitle')!;
        $subtitle.textContent = 'Checkout';

        if (this.wallets.length === 0) {
            this.goToOnboarding(true);
            return;
        }
    }

    private async mounted() {
        // Requires Network child component to be rendered
        this.addConsensusListeners();
        const balances = await this.getBalances();

        // Handle optional sender address included in the request
        if (this.request.sender) {
            let errorMsg = '';
            // Check if the address exists
            const senderAddress = this.request.sender.toUserFriendlyAddress();
            const wallet = this.findWalletByAddress(senderAddress, true);
            if (wallet) {
                // Check if that address has enough balance
                const balance = balances.get(senderAddress);
                if (balance && Nimiq.Policy.coinsToSatoshis(balance) >= this.minBalance) {
                    // Forward to Keyguard, skipping account selection
                    this.setAccountOrContract(wallet.id, senderAddress, true);
                    return;
                } else {
                    errorMsg = 'Address does not have sufficient balance';
                }
            } else {
                errorMsg = 'Address not found';
            }

            if (this.request.forceSender) {
                this.$rpc.reject(new Error(errorMsg));
                return;
            }
        }

        // Remove StatusScreen to unveil account selector
        this.hasBalances = true;
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
        window.sessionStorage.setItem(Checkout.BALANCE_CHECK_STORAGE_KEY, JSON.stringify(cacheInput));

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

    private setAccountOrContract(walletId: string, address: string, isFromRequest = false) {
        const nimiqAddress = Nimiq.Address.fromUserFriendlyAddress(address);
        const senderAccount = this.wallets.find((wallet: WalletInfo) => wallet.id === walletId)!;
        const senderContract = senderAccount.findContractByAddress(nimiqAddress);
        const signer = senderAccount.findSignerForAddress(nimiqAddress)!;

        // FIXME: Also handle active account we get from store
        this.$setActiveAccount({
            walletId: senderAccount.id,
            userFriendlyAddress: (senderContract || signer).userFriendlyAddress,
        });

        // proceed to transaction signing
        switch (senderAccount.type) {
            case WalletType.LEDGER:
                this.$rpc.routerPush(`${RequestType.SIGN_TRANSACTION}-ledger`);
                return;
            case WalletType.LEGACY:
            case WalletType.BIP39:
                if (!this.height) return;

                // The next block is the earliest for which tx are accepted by standard miners
                const validityStartHeight = this.height + 1
                    - TX_VALIDITY_WINDOW
                    + this.request.validityDuration;

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
                    recipient: this.request.recipient.serialize(),
                    recipientType: this.request.recipientType,
                    // recipientLabel: '', // Checkout is using the shopOrigin instead
                    value: this.request.value,
                    fee: this.request.fee,
                    validityStartHeight,
                    data: this.request.data,
                    flags: this.request.flags,
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

    private close() {
        this.$rpc.reject(new Error(ERROR_CANCELED));
    }

    private get hasSufficientBalanceAccount(): boolean {
        return this.wallets.some((wallet: WalletInfo) => [...wallet.accounts.values(), ...wallet.contracts]
            .some((info: AccountInfo | ContractInfo) => !!info.balance && info.balance >= this.minBalance));
    }

    private get shopOrigin() {
        return this.rpcState.origin.split('://')[1];
    }

    private get minBalance() {
        return this.request.value + this.request.fee;
    }

    private getLastBalanceUpdateHeight(): {timestamp: number, height: number, balances: Map<string, number>} | null {
        const rawCache = window.sessionStorage.getItem(Checkout.BALANCE_CHECK_STORAGE_KEY);
        if (!rawCache) return null;

        try {
            const cache: {timestamp: number, height: number, balances: Array<[string, number]>} = JSON.parse(rawCache);

            // Check if expired or doesn't have a height
            if (cache.timestamp < Date.now() - 5 * 60 * 1000 || cache.height === 0) throw new Error();

            return Object.assign(cache, {
                balances: new Map(cache.balances),
            });
        } catch (e) {
            window.sessionStorage.removeItem(Checkout.BALANCE_CHECK_STORAGE_KEY);
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

    .account-details {
        position: absolute;
        left: 0;
        top: 0;
        opacity: 1;
        z-index: 1;
        transition: opacity .3s;
    }

    .account-details-fade-enter,
    .account-details-fade-leave-to {
        opacity: 0;
    }

    .merchant-info-shown > :not(.account-details) {
        filter: blur(.75rem);
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

