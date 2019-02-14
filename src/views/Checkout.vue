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

            <h1 class="nq-h1">Choose an account to pay</h1>

            <div v-if="!hasSufficientBalanceAccount" class="non-sufficient-balance">
                <p class="nq-text nq-orange">None of your accounts has sufficient balance.</p>
                <a href="https://changelly.com/exchange/btc/nim?ref_id=v06xmpbqj5lpftuj" target="_blank">
                    <button class="nq-button-s nq-light-blue-bg"><i class="nq-icon exchange"></i> Get NIM&nbsp;</button>
                </a>
            </div>

            <AccountSelector
                :wallets="processedWallets"
                :minBalance="request.value + request.fee"
                @account-selected="accountSelected"
                @login="login"/>

            <AccountInfoScreen
                :address="request.recipient.toUserFriendlyAddress()"
                :origin="rpcState.origin"
                :shopLogoUrl="request.shopLogoUrl"
                @close="showMerchantInfo = false"
            />
        </SmallPage>

        <button class="global-close nq-button-s" :class="{'hidden': $route.name === 'checkout-success'}" @click="close">
            <span class="nq-icon arrow-left"></span>
            Cancel Payment
        </button>

        <Network ref="network" :visible="false" @head-change="onHeadChange"/>
    </div>
</template>

<script lang="ts">
import Nimiq from '@nimiq/core-web';
import KeyguardClient from '@nimiq/keyguard-client';
import { Component, Emit, Watch, Vue } from 'vue-property-decorator';
import { PaymentInfoLine, AccountSelector, AccountInfo as AccountInfoScreen, SmallPage } from '@nimiq/vue-components';
import { ParsedCheckoutRequest, RequestType, LoginResult } from '@/lib/RequestTypes';
import { State as RpcState } from '@nimiq/rpc';
import staticStore, { Static } from '@/lib/StaticStore';
import { WalletStore } from '@/lib/WalletStore';
import { AccountInfo } from '@/lib/AccountInfo';
import { WalletInfo, WalletType } from '@/lib/WalletInfo';
import { State, Mutation } from 'vuex-class';
import { TX_VALIDITY_WINDOW, LEGACY_GROUPING_WALLET_ID, LEGACY_GROUPING_WALLET_LABEL } from '@/lib/Constants';
import Network from '@/components/Network.vue';
import Loader from '@/components/Loader.vue';

@Component({components: {PaymentInfoLine, AccountSelector, AccountInfoScreen, SmallPage, Network, Loader}})
export default class Checkout extends Vue {
    private static readonly BALANCE_CHECK_STORAGE_KEY = 'nimiq_checkout_last_balance_check';

    @Static private rpcState!: RpcState;
    @Static private request!: ParsedCheckoutRequest;
    @State private wallets!: WalletInfo[];

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
        this.getBalances();
    }

    private async getBalances() {
        const isRefresh = !window.performance || performance.navigation.type === 1;

        if (!this.sideResultAddedWallet && this.getLastBalanceUpdateHeight() && !isRefresh) {
            this.onHeadChange(this.getLastBalanceUpdateHeight()!);
        } else {
            // Copy wallets to be able to manipulate them
            const wallets = this.wallets.slice(0);

            // Generate a new array with references to the respective wallets' accounts
            const accounts = wallets.reduce((accs, wallet) => {
                accs.push(...wallet.accounts.values());
                return accs;
            }, [] as AccountInfo[]);

            // Reduce userfriendly addresses from that
            const addresses = accounts.map((account) => account.userFriendlyAddress);

            // Get balances through pico consensus, also triggers head-change event
            const network = (this.$refs.network as Network);
            const balances: Map<string, number> = await network.connectPico(addresses);

            // Update accounts with their balances
            // (The accounts are still references to themselves in the wallets' accounts maps)
            for (const account of accounts) {
                const balance = balances.get(account.userFriendlyAddress);
                if (balance === undefined) continue;
                account.balance = Nimiq.Policy.coinsToSatoshis(balance);
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
            };
            window.sessionStorage.setItem(Checkout.BALANCE_CHECK_STORAGE_KEY, JSON.stringify(cacheInput));
        }

        // Remove loader
        this.hasBalances = true;
    }

    private onHeadChange(head: Nimiq.BlockHeader | {height: number}) {
        this.height = head.height;
    }

    private accountSelected(walletId: string, address: string) {
        if (!this.height) return; // TODO: Make it impossible for users to click when height is not ready

        const walletInfo = this.wallets.find((wallet: WalletInfo) => wallet.id === walletId)!;
        const accountInfo = walletInfo.accounts.get(address)!;

        // FIXME: Currently unused, but should be reactivated
        this.$store.commit('setActiveAccount', {
            walletId: walletInfo.id,
            userFriendlyAddress: accountInfo.userFriendlyAddress,
        });

        this.proceedToKeyguard(walletInfo, accountInfo);
    }

    private proceedToKeyguard(walletInfo: WalletInfo, accountInfo: AccountInfo) {
        // The next block is the earliest for which tx are accepted by standard miners
        const validityStartHeight = this.height + 1
            - TX_VALIDITY_WINDOW
            + this.request.validityDuration;

        const request: KeyguardClient.SignTransactionRequest = {
            layout: 'checkout',
            shopOrigin: this.rpcState.origin,
            appName: this.request.appName,
            shopLogoUrl: this.request.shopLogoUrl,

            keyId: walletInfo.id,
            keyPath: accountInfo.path,
            keyLabel: walletInfo.label,

            sender: accountInfo.address.serialize(),
            senderType: Nimiq.Account.Type.BASIC,
            senderLabel: accountInfo.label,
            recipient: this.request.recipient.serialize(),
            recipientType: this.request.recipientType,
            // recipientLabel: '', // Checkout is using the shopOrigin instead
            value: this.request.value,
            fee: this.request.fee || 0,
            validityStartHeight,
            data: this.request.data,
            flags: this.request.flags,
        };

        const storedRequest = Object.assign({}, request, {
            sender: Array.from(request.sender),
            recipient: Array.from(request.recipient),
            data: Array.from(request.data!),
        });
        staticStore.keyguardRequest = storedRequest;

        const client = this.$rpc.createKeyguardClient();
        client.signTransaction(request).catch(console.error); // TODO: proper error handling
    }

    private login() {
        // Redirect to import
        const request: KeyguardClient.ImportRequest = {
            appName: this.request.appName,
            defaultKeyPath: `m/44'/242'/0'/0'`,
            requestedKeyPaths: [`m/44'/242'/0'/0'`],
        };

        staticStore.originalRouteName = RequestType.CHECKOUT;

        const client = this.$rpc.createKeyguardClient();
        client.import(request).catch(console.error); // TODO: proper error handling
    }

    @Emit()
    private close() {
        this.$rpc.reject(new Error('CANCEL'));
    }

    private get processedWallets(): WalletInfo[] {
        const singleAccounts = new Map<string, AccountInfo>();

        const filteredWallets = this.wallets.filter((wallet) => {
            if (wallet.type !== WalletType.LEGACY) return true;

            const [singleAccountAddress, singleAccountInfo] = Array.from(wallet.accounts.entries())[0];
            singleAccountInfo.walletId = wallet.id;
            singleAccounts.set(singleAccountAddress, singleAccountInfo);

            return false;
        });

        if (singleAccounts.size > 0) {
            filteredWallets.push(new WalletInfo(
                LEGACY_GROUPING_WALLET_ID,
                LEGACY_GROUPING_WALLET_LABEL,
                singleAccounts,
                [],
                WalletType.LEGACY,
            ));
        }

        return filteredWallets;
    }

    private get hasSufficientBalanceAccount(): boolean {
        const minBalance = this.request.value + (this.request.fee || 0);
        return this.wallets.some((wallet: WalletInfo) => {
            return Array.from(wallet.accounts.values()).some((account: AccountInfo) => {
                return !!account.balance && account.balance >= minBalance;
            });
        });
    }

    private async handleOnboardingResult() {
        // Check if we are returning from an onboarding request
        if (staticStore.sideResult && !(staticStore.sideResult instanceof Error)) {
            const sideResult = staticStore.sideResult as LoginResult;

            // Add imported wallet to Vuex store
            const walletInfo = await WalletStore.Instance.get(sideResult.walletId);
            if (walletInfo) {
                this.$addWallet(walletInfo);
                this.sideResultAddedWallet = true;

                // Set as activeWallet and activeAccount
                // FIXME: Currently unused, but should be reactivated
                this.$setActiveAccount({
                    walletId: walletInfo.id,
                    userFriendlyAddress: walletInfo.accounts.values().next().value.userFriendlyAddress,
                });
            }
        }
        delete staticStore.sideResult;
    }

    private getLastBalanceUpdateHeight(): {timestamp: number, height: number} | null {
        const rawCache = window.sessionStorage.getItem(Checkout.BALANCE_CHECK_STORAGE_KEY);
        if (!rawCache) return null;

        try {
            const cache: {timestamp: number, height: number} = JSON.parse(rawCache);

            // Check if expired or doesn't have a height
            if (cache.timestamp < Date.now() - 5 * 60 * 1000 || cache.height === 0) throw new Error();

            return cache;
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
        height: 70rem;
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

    .account-info {
        position: absolute;
        left: 0;
        top: 0;
        opacity: 0;
        z-index: -1;
        transition: opacity 300ms, z-index 300ms;
    }

    .merchant-info-shown > :not(.account-info) {
        filter: blur(.75rem);
    }

    .merchant-info-shown > .account-info {
        z-index: 29;
        opacity: 1;
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

