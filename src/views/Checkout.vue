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
                <a href="https://changelly.com/exchange/BTC/NIM?ref_id=v06xmpbqj5lpftuj" target="_blank"><button class="nq-button-s blue"><i class="nq-icon exchange"></i> Get NIM&nbsp;</button></a>
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
    private static readonly CACHE_STORAGE_KEY = 'nimiq_checkout_cache';

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
        const span = document.createElement('span');
        span.setAttribute('id', 'logo-checkout');
        span.textContent = 'Checkout';
        document.querySelector('.logo')!.appendChild(span);

        await this.handleOnboardingResult();
        this.getBalances();
    }

    private async getBalances() {
        const isRefresh = !window.performance || performance.navigation.type === 1;

        if (!this.sideResultAddedWallet && this.getCache() && !isRefresh) {
            this.onHeadChange(this.getCache());
        } else {
            // Build mapping from accounts to the index of their respective wallet in the wallets array
            const accountsToWallets: Map<string, number> = new Map();
            this.wallets.forEach((wallet: WalletInfo, index: number) => {
                for (const address of Array.from(wallet.accounts.keys())) {
                    accountsToWallets.set(address, index);
                }
            });

            // Get balances through pico consensus, also triggers head-change event
            const network = (this.$refs.network as Network);
            const balances: Map<string, number> = await network.connectPico(Array.from(accountsToWallets.keys()));

            // Copy wallets to be able to write to them
            const wallets = this.wallets.slice(0);

            // Add received account balances to correct AccountInfos in correct wallets
            for (const [address, balance] of balances) {
                const index = accountsToWallets.get(address)!;
                const accountInfo = wallets[index].accounts.get(address)!;
                accountInfo.balance = Nimiq.Policy.coinsToSatoshis(balance);
                wallets[index].accounts.set(address, accountInfo);
            }

            // Store new balances
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
            window.sessionStorage.setItem(Checkout.CACHE_STORAGE_KEY, JSON.stringify(cacheInput));
        }

        // Remove loader
        this.hasBalances = true;
    }

    @Watch('height')
    private logHeightChange(height: number, oldHeight: number) {
        console.debug(`Got height: ${height} (was ${oldHeight})`);
    }

    private onHeadChange(head: Nimiq.BlockHeader | {height: number}) {
        this.height = head.height;
    }

    private accountSelected(walletId: string, address: string) {
        if (!this.height) return; // TODO: Make it impossible for users to click when height is not ready

        const walletInfo = this.wallets.find((wallet: WalletInfo) => wallet.id === walletId);
        if (!walletInfo) {
            console.error('Selected Wallet not found:', walletId);
            return;
        }

        const accountInfo = walletInfo.accounts.get(address);
        if (!accountInfo) {
            console.error('Selected AccountInfo not found:', address);
            return;
        }

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

        const request: KeyguardRequest.SignTransactionRequest = {
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
        const request: KeyguardRequest.ImportRequest = {
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

            const accountArray = Array.from(wallet.accounts.entries())[0];
            accountArray[1].walletId = wallet.id;
            singleAccounts.set(accountArray[0], accountArray[1]);
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
        return this.wallets.find((wallet: WalletInfo) => {
            return Array.from(wallet.accounts.values()).find((account: AccountInfo) => {
                return account.balance ? account.balance >= minBalance : false;
            }) !== undefined;
        }) !== undefined;
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
                this.$setActiveAccount({
                    walletId: walletInfo.id,
                    userFriendlyAddress: walletInfo.accounts.values().next().value.userFriendlyAddress,
                });
            }
        }
        delete staticStore.sideResult;
    }

    private getCache() {
        const rawCache = window.sessionStorage.getItem(Checkout.CACHE_STORAGE_KEY);
        if (!rawCache) return null;

        try {
            const cache = JSON.parse(rawCache);

            // Check if expired or doesn't have a height
            if (cache.timestamp < Date.now() - 5 * 60 * 1000 || cache.height === 0) throw new Error();

            return cache;
        } catch (e) {
            window.sessionStorage.removeItem(Checkout.CACHE_STORAGE_KEY);
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
        z-index: 10;
        flex-shrink: 0;
    }

    .non-sufficient-balance .nq-text {
        opacity: 1;
        font-weight: 600;
    }

    .non-sufficient-balance .nq-button-s {
        background: var(--nimiq-light-blue);
        background-image: var(--nimiq-light-blue-bg);
        color: white;
    }

    .non-sufficient-balance .nq-icon.exchange {
        width: 2rem;
        height: 2rem;
        margin-right: 0.5rem;
        background-size: 125%;
        vertical-align: text-bottom;
        background-image: url('data:image/svg+xml,<svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.5139 18.4826C13.1117 18.8276 13.876 18.6228 14.2212 18.0251L18.4326 10.7307C18.4602 10.6828 18.5058 10.6477 18.5593 10.6334C18.6127 10.6191 18.6697 10.6266 18.7176 10.6544L19.6196 11.1745C19.811 11.285 20.0384 11.315 20.2519 11.2578C20.3246 11.2387 20.3943 11.2096 20.459 11.1713C20.7167 11.0183 20.8724 10.7387 20.8668 10.4391L20.7875 5.58076C20.7823 5.28816 20.6241 5.01969 20.3706 4.87347C20.1171 4.72725 19.8055 4.72472 19.5497 4.8668L15.3011 7.2251C15.0403 7.37123 14.8778 7.64586 14.8751 7.9448C14.8725 8.24373 15.0302 8.52117 15.2884 8.67184L16.1907 9.19274C16.29 9.2503 16.3241 9.37737 16.2668 9.47688L12.0556 16.7721C11.889 17.0595 11.8437 17.4015 11.9297 17.7225C12.0157 18.0434 12.2259 18.3169 12.5139 18.4826V18.4826Z" fill="white"/><path d="M10.2922 6.43794L5.8465 13.6467C5.78762 13.7428 5.66277 13.7744 5.5653 13.7177L4.87456 13.3196C4.61464 13.1696 4.29413 13.1709 4.03546 13.3231C3.77678 13.4752 3.61991 13.7547 3.62475 14.0548L3.70669 18.9133C3.71114 19.1698 3.83345 19.4099 4.03826 19.5643C4.24308 19.7187 4.50758 19.7702 4.75535 19.7038C4.82127 19.6861 4.88478 19.6604 4.94448 19.6273L9.19304 17.269C9.45347 17.1228 9.61574 16.8484 9.6184 16.5498C9.62106 16.2511 9.4637 15.9739 9.20591 15.8231L8.09263 15.181C8.04403 15.1524 8.00883 15.1056 7.99483 15.051C7.98092 14.9964 7.99003 14.9384 8.02003 14.8907L12.4224 7.74877C12.6728 7.3684 12.6965 6.88193 12.4843 6.47899C12.2721 6.07605 11.8576 5.8204 11.4023 5.81168C10.9469 5.80296 10.5229 6.04256 10.2954 6.43708L10.2922 6.43794Z" fill="white"/></svg>');
    }
</style>

<style>
    #logo-checkout {
        margin-left: 0.75rem;
        text-transform: none;
        letter-spacing: initial;
    }
</style>
