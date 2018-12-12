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
import { TX_VALIDITY_WINDOW } from '@/lib/Constants';
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
        this.getHeight();
        this.getBalances();
    }

    private async getHeight() {
        try {
            await this.setHeightFromApi();
        } catch (e) {
            console.error(e);
        }
    }

    private async getBalances() {
        const network = (this.$refs.network as Network);
        await network.connect();

        const balancePromises: Array<Promise<WalletInfo>> = this.wallets.map((wallet: WalletInfo) => {
            const addresses = Array.from(wallet.accounts.keys());

            return network.getBalances(addresses).then((balances: Map<string, number>) => {
                for (const address of addresses) {
                    const accountInfo = wallet.accounts.get(address)!;
                    accountInfo.balance = Nimiq.Policy.coinsToSatoshis(balances.get(address)!);
                    wallet.accounts.set(address, accountInfo);
                }
                return wallet;
            });
        });

        const wallets = await Promise.all(balancePromises);

        for (const wallet of wallets) {
            // Update IndexedDB
            await WalletStore.Instance.put(wallet);

            // Update Vuex
            this.$addWallet(wallet);
        }
        this.hasBalances = true;
    }

    @Watch('height')
    private logHeightChange(height: number, oldHeight: number) {
        console.debug(`Got height: ${height} (was ${oldHeight})`);
    }

    private async setHeightFromApi() {
        const raw = await fetch('https://test-api.nimiq.watch/latest/1');
        const result = await raw.json();
        this.height = result[0].height;
    }

    private onHeadChange(head: Nimiq.BlockHeader) {
        this.height = head.height;
    }

    private accountSelected(walletId: string, address: string) {
        if (!this.height) return; // TODO: Make it impossible for user to click when height is not ready

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
            singleAccounts.set(accountArray[0], accountArray[1]);
            return false;
        });

        filteredWallets.push(new WalletInfo(
            'LEGACY',
            'Single Accounts',
            singleAccounts,
            [],
            WalletType.LEGACY,
        ));

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
