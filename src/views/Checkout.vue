<template>
    <div class="container">
        <SmallPage v-if="height === 0 || !hasBalances">
            <Loader title="Updating your balances" status="Connecting to Nimiq..."/>
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

            <h1 class="nq-h1">Choose an address to pay</h1>

            <div v-if="!hasSufficientBalanceAccount" class="non-sufficient-balance">
                <p class="nq-text nq-orange">None of your addresses has sufficient balance.</p>
                <a href="https://changelly.com/exchange/btc/nim?ref_id=v06xmpbqj5lpftuj" target="_blank">
                    <button class="nq-button-s nq-light-blue-bg"><i class="nq-icon exchange"></i> Get NIM&nbsp;</button>
                </a>
            </div>

            <AccountSelector
                :wallets="processedWallets"
                :minBalance="minBalance"
                @account-selected="setAccountOrContract"
                @login="goToOnboarding"/>

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
            <span class="nq-icon arrow-left"></span>
            Cancel Payment
        </button>

        <Network ref="network" :visible="false" @head-change="onHeadChange"/>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { PaymentInfoLine, AccountSelector, AccountDetails, SmallPage } from '@nimiq/vue-components';
import { ParsedCheckoutRequest, RequestType } from '../lib/RequestTypes';
import { Account } from '../lib/PublicRequestTypes';
import { State as RpcState } from '@nimiq/rpc';
import staticStore, { Static } from '@/lib/StaticStore';
import { WalletStore } from '@/lib/WalletStore';
import { AccountInfo } from '@/lib/AccountInfo';
import { WalletInfo, WalletType } from '@/lib/WalletInfo';
import { State, Mutation, Getter } from 'vuex-class';
import {
    TX_VALIDITY_WINDOW,
    LEGACY_GROUPING_ACCOUNT_ID,
    LEGACY_GROUPING_ACCOUNT_LABEL,
    ERROR_CANCELED,
} from '@/lib/Constants';
import Network from '@/components/Network.vue';
import Loader from '@/components/Loader.vue';
import KeyguardClient from '@nimiq/keyguard-client';
import { ContractInfo, VestingContractInfo } from '@/lib/ContractInfo';

@Component({components: {PaymentInfoLine, AccountSelector, AccountDetails, SmallPage, Network, Loader}})
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
    private sideResultAddedWallet: boolean = false;

    private async created() {
        const $subtitle = document.querySelector('.logo .logo-subtitle')!;
        $subtitle.textContent = 'Checkout';

        await this.handleOnboardingResult();

        if (this.wallets.length === 0) {
            this.goToOnboarding(true);
            return;
        }

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
                if (balance && balance >= this.minBalance) {
                    // Forward to Keyguard, skipping account selection
                    this.setAccountOrContract(wallet.id, senderAddress);
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

        // Remove loader to unveil account selector
        this.hasBalances = true;
    }

    private async getBalances(): Promise<Map<string, number>> {
        const isRefresh = !window.performance || performance.navigation.type === 1;

        const cache = this.getLastBalanceUpdateHeight();
        if (!this.sideResultAddedWallet && cache && !isRefresh) {
            this.onHeadChange(cache);
            return cache.balances;
        } else {
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
            const balances: Map<string, number> = await network.connectPico(addresses);

            // Update accounts/contracts with their balances
            // (The accounts are still references to themselves in the wallets' accounts maps)
            for (const accountOrContract of accountsAndContracts) {
                const balance = balances.get(accountOrContract.userFriendlyAddress);
                if (balance === undefined) continue;

                if ('type' in accountOrContract && accountOrContract.type === Nimiq.Account.Type.VESTING) {
                    // Calculate available amount for vesting contract
                    accountOrContract.balance = accountOrContract
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

            // Cache height (balances are stored in IndexedDB)
            const cacheInput = {
                timestamp: Date.now(),
                height: this.height,
                balances: Array.from(balances.entries());
            };
            window.sessionStorage.setItem(Checkout.BALANCE_CHECK_STORAGE_KEY, JSON.stringify(cacheInput));

            return balances;
        }
    }

    private onHeadChange(head: Nimiq.BlockHeader | {height: number}) {
        this.height = head.height;
    }

    private setAccountOrContract(walletId: string, address: string) {
        if (!this.height) return; // TODO: Make it impossible for users to click when height is not ready

        const walletInfo = this.wallets.find((wallet: WalletInfo) => wallet.id === walletId)!;
        let accountInfo = walletInfo.accounts.get(address);
        let contractInfo: ContractInfo | undefined;
        if (!accountInfo) {
            // Search contracts
            contractInfo = walletInfo.findContractByAddress(Nimiq.Address.fromUserFriendlyAddress(address))!;
            if (contractInfo.type === Nimiq.Account.Type.HTLC) {
                alert('HTLC contracts are not yet supported for checkout');
                return;
            }
            accountInfo = walletInfo.accounts.get(contractInfo.owner.toUserFriendlyAddress());
        }

        // FIXME: Currently unused, but should be reactivated
        this.$store.commit('setActiveAccount', {
            walletId: walletInfo.id,
            userFriendlyAddress: accountInfo!.userFriendlyAddress,
        });

        // The next block is the earliest for which tx are accepted by standard miners
        const validityStartHeight = this.height + 1
            - TX_VALIDITY_WINDOW
            + this.request.validityDuration;

        const request: KeyguardClient.SignTransactionRequest = {
            layout: 'checkout',
            shopOrigin: this.rpcState.origin,
            appName: this.request.appName,
            shopLogoUrl: this.request.shopLogoUrl,

            keyId: walletInfo.keyId,
            keyPath: accountInfo!.path,
            keyLabel: walletInfo.label,

            sender: (contractInfo || accountInfo!).address.serialize(),
            senderType: contractInfo ? contractInfo.type : Nimiq.Account.Type.BASIC,
            senderLabel: (contractInfo || accountInfo!).label,
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

        const client = this.$rpc.createKeyguardClient();
        client.signTransaction(request);
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
        return this.wallets.some((wallet: WalletInfo) => {
            return Array.from(wallet.accounts.values()).some((account: AccountInfo) => {
                return !!account.balance && account.balance >= this.minBalance;
            });
        });
    }

    private get shopOrigin() {
        return this.rpcState.origin.split('://')[1];
    }

    private get minBalance() {
        return this.request.value + this.request.fee;
    }

    private async handleOnboardingResult() {
        // Check if we are returning from an onboarding request
        if (staticStore.sideResult && !(staticStore.sideResult instanceof Error)) {
            const sideResult = staticStore.sideResult as Account;

            // Add imported wallet to Vuex store
            const walletInfo = await WalletStore.Instance.get(sideResult.accountId);
            if (walletInfo) {
                this.$addWallet(walletInfo);
                this.sideResultAddedWallet = true;

                // Set as activeWallet and activeAccount
                // FIXME: Currently unused, but should be reactivated
                const activeAccount = walletInfo.accounts.values().next().value;

                this.$setActiveAccount({
                    walletId: walletInfo.id,
                    userFriendlyAddress: activeAccount.userFriendlyAddress,
                });
            }
        }
        delete staticStore.sideResult;
    }

    private getLastBalanceUpdateHeight(): {timestamp: number, height: number, balances: Map<string, number>} | null {
        const rawCache = window.sessionStorage.getItem(Checkout.BALANCE_CHECK_STORAGE_KEY);
        if (!rawCache) return null;

        try {
            const cache: {timestamp: number, height: number, balances: [string, number][]} = JSON.parse(rawCache);

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

    .loader {
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
    }

    .non-sufficient-balance .nq-icon.exchange {
        width: 2rem;
        height: 2rem;
        margin-right: 0.5rem;
        background-size: 125%;
        vertical-align: text-bottom;
        background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 25"><path fill="white" d="M12.51 18.48c.6.35 1.37.14 1.71-.45l4.21-7.3a.2.2 0 0 1 .29-.08l.9.52a.83.83 0 0 0 1.25-.73l-.08-4.86a.83.83 0 0 0-1.24-.71L15.3 7.23a.83.83 0 0 0-.01 1.44l.9.52c.1.06.13.19.08.29l-4.21 7.3a1.25 1.25 0 0 0 .45 1.7zM10.3 6.44l-4.45 7.2a.2.2 0 0 1-.28.08l-.7-.4a.83.83 0 0 0-1.25.73l.09 4.86a.83.83 0 0 0 1.23.72l4.25-2.36a.83.83 0 0 0 .02-1.45l-1.12-.64a.21.21 0 0 1-.1-.13.2.2 0 0 1 .03-.16l4.4-7.14a1.25 1.25 0 1 0-2.12-1.31z"/></svg>');
    }
</style>

