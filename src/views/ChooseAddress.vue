<template>
    <div class="container">
       <SmallPage>
            <h1 class="nq-h1">Choose an address</h1>

            <div class="request-info nq-text">
                {{ request.appName }} is asking for an address to use.
            </div>

            <AccountSelector
                :wallets="processedWallets"
                @account-selected="accountSelected"
                @login="goToOnboarding"/>

        </SmallPage>

        <button class="global-close nq-button-s" @click="close">
            <span class="nq-icon arrow-left"></span>
            Back to {{request.appName}}
        </button>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Emit } from 'vue-property-decorator';
import { State, Mutation } from 'vuex-class';
import { SmallPage, AccountSelector } from '@nimiq/vue-components';
import { RequestType, SimpleRequest, OnboardingResult } from '../lib/RequestTypes';
import staticStore, { Static } from '@/lib/StaticStore';
import { WalletStore } from '@/lib/WalletStore';
import { WalletInfo, WalletType } from '../lib/WalletInfo';
import { AccountInfo } from '../lib/AccountInfo';
import { TX_VALIDITY_WINDOW, LEGACY_GROUPING_WALLET_ID, LEGACY_GROUPING_WALLET_LABEL } from '../lib/Constants';
import { ERROR_CANCELED } from '../lib/Constants';

@Component({components: { AccountSelector, SmallPage }})
export default class ChooseAddress extends Vue {
    @Static private request!: SimpleRequest;
    @State private wallets!: WalletInfo[];

    @Mutation('addWallet') private $addWallet!: (walletInfo: WalletInfo) => any;
    @Mutation('setActiveAccount') private $setActiveAccount!: (payload: {
        walletId: string,
        userFriendlyAddress: string,
    }) => any;

    public async created() {
        await this.handleOnboardingResult();

        if (this.wallets.length === 0) {
            this.goToOnboarding(true);
        }
    }

    private accountSelected(walletId: string, address: string) {
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

        const result = {
            address: accountInfo.userFriendlyAddress,
            label: accountInfo.label,
        };

        this.$rpc.resolve(result);
    }

    private goToOnboarding(useReplace?: boolean) {
        // Redirect to onboarding
        staticStore.originalRouteName = RequestType.CHOOSE_ADDRESS;
        if (useReplace) {
            this.$rpc.routerReplace(RequestType.ONBOARD);
        }
        this.$rpc.routerPush(RequestType.ONBOARD);
    }

     private async handleOnboardingResult() {
        // Check if we are returning from an onboarding request
        if (staticStore.sideResult && !(staticStore.sideResult instanceof Error)) {
            const sideResult = staticStore.sideResult as OnboardingResult;

            // Add imported wallet to Vuex store
            const walletInfo = await WalletStore.Instance.get(sideResult.walletId);
            if (walletInfo) {
                this.$addWallet(walletInfo);

                // Set as activeWallet and activeAccount
                const activeAccount = walletInfo.accounts.values().next().value;

                this.$setActiveAccount({
                    walletId: walletInfo.id,
                    userFriendlyAddress: activeAccount.userFriendlyAddress,
                });

                // Return the generated address
                const result = {
                    address: activeAccount.userFriendlyAddress,
                    label: activeAccount.label,
                };

                this.$rpc.resolve(result);
            }
        }
        delete staticStore.sideResult;
    }

    @Emit()
    private close() {
        this.$rpc.reject(new Error(ERROR_CANCELED));
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
}
</script>

<style scoped>
    .small-page {
        position: relative;
        height: 70rem;
    }

    .account-info {
        position: absolute;
        left: 0;
        top: 0;
        opacity: 0;
        z-index: -1;
        transition: opacity 300ms, z-index 300ms;
    }

    .nq-h1 {
        margin-top: 3.5rem;
        margin-bottom: 1rem;
        line-height: 1;
        text-align: center;
    }

    .request-info {
        text-align: center;
        margin-left: 2rem;
        margin-right: 2rem;
        flex-shrink: 0;
    }
</style>
