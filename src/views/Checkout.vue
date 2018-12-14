<template>
    <div class="container">
        <SmallPage v-if="height === 0 || !hasBalances">
            <Loader title="Updating your balances" status="Connecting to Nimiq..."/>
        </SmallPage>

        <SmallPage v-else>
            <PaymentInfoLine v-if="rpcState"
                :amount="request.value"
                :fee="request.fee"
                :address="request.recipient.toUserFriendlyAddress()"
                :origin="rpcState.origin"
                :shopLogoUrl="request.shopLogoUrl"
                @merchant-info-clicked="showMerchantInfo = true"
            />

            <h1 class="nq-h1">Choose an account to pay</h1>

            <AccountSelector
                :wallets="processedWallets"
                :minBalance="request.value + request.fee"
                @account-selected="accountSelected"
                @login="login"/>

            <AccountInfoScreen :class="{'active': showMerchantInfo}"
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

    private mounted() {
        this.getBalances();
    }

    private async getBalances() {
        const network = (this.$refs.network as Network);

        // Build mapping from accounts to the index of their respective wallet in the wallets array
        const accountsToWallets: Map<string, number> = new Map();
        this.wallets.forEach((wallet: WalletInfo, index: number) => {
            for (const address of Array.from(wallet.accounts.keys())) {
                accountsToWallets.set(address, index);
            }
        });

        // Get balances through pico consensus, also triggers head-change event
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

        // Remove loader
        this.hasBalances = true;
    }

    @Watch('height')
    private logHeightChange(height: number, oldHeight: number) {
        console.debug(`Got height: ${height} (was ${oldHeight})`);
    }

    private onHeadChange(head: Nimiq.BlockHeader) {
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

    private async created() {
        // Check if we are returning from the login request
        if (staticStore.sideResult && !(staticStore.sideResult instanceof Error)) {
            const sideResult = staticStore.sideResult as LoginResult;
            // Add imported wallet to store and pre-select wallet (if regular wallet)
            // or stay on first page for imported legacy wallet

            const walletInfo = await WalletStore.Instance.get(sideResult.walletId);
            if (!walletInfo) return;
            this.$addWallet(walletInfo);

            // Set as activeWallet and activeAccount
            this.$setActiveAccount({
                walletId: walletInfo.id,
                userFriendlyAddress: walletInfo.accounts.values().next().value.userFriendlyAddress,
            });
        }
        delete staticStore.sideResult;
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

    .account-info.active {
        z-index: 29;
        opacity: 1;
    }
</style>
