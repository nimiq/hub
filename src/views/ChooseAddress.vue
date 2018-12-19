<template>
    <div class="container">
       <SmallPage>
            <h1 class="nq-h1">Choose an address for {{ request.appName }}</h1>
            
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
import { RequestType, SimpleRequest } from '../lib/RequestTypes';
import staticStore, { Static } from '@/lib/StaticStore';
import { WalletInfo, WalletType } from '../lib/WalletInfo';
import { AccountInfo } from '../lib/AccountInfo';
import { TX_VALIDITY_WINDOW, LEGACY_GROUPING_WALLET_ID, LEGACY_GROUPING_WALLET_LABEL } from '../lib/Constants';

@Component({components: { AccountSelector, SmallPage }})
export default class ChooseAddress extends Vue {
    @Static private request!: SimpleRequest;
    @State private wallets!: WalletInfo[];

    public created() {
        // we could need this
        // await this.handleOnboardingResult();

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
        }

        this.$rpc.resolve(result);
    }

    private goToOnboarding(useReplace?: boolean) {
        // Redirect to onboarding
        staticStore.originalRouteName = RequestType.CHECKOUT;
        if (useReplace) {
            this.$rpc.routerReplace(RequestType.ONBOARD);
        }
        this.$rpc.routerPush(RequestType.ONBOARD);
    }

    @Emit()
    private close() {
        this.$rpc.reject(new Error('CANCELED'));
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

    .account-info {
        position: absolute;
        left: 0;
        top: 0;
        opacity: 0;
        z-index: -1;
        transition: opacity 300ms, z-index 300ms;
    }
</style>