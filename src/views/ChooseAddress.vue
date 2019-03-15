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
import { Getter, Mutation } from 'vuex-class';
import { SmallPage, AccountSelector } from '@nimiq/vue-components';
import { RequestType, SimpleRequest, OnboardingResult, ChooseAddressResult } from '../lib/RequestTypes';
import staticStore, { Static } from '@/lib/StaticStore';
import { WalletStore } from '@/lib/WalletStore';
import { WalletInfo } from '../lib/WalletInfo';
import { ERROR_CANCELED } from '../lib/Constants';

@Component({components: { AccountSelector, SmallPage }})
export default class ChooseAddress extends Vue {
    @Static private request!: SimpleRequest;

    @Getter private findWallet!: (id: string) => WalletInfo | undefined;
    @Getter private processedWallets!: WalletInfo[];

    @Mutation('addWallet') private $addWallet!: (walletInfo: WalletInfo) => any;
    @Mutation('setActiveAccount') private $setActiveAccount!: (payload: {
        walletId: string,
        userFriendlyAddress: string,
    }) => any;

    public async created() {
        await this.handleOnboardingResult();

        if (this.processedWallets.length === 0) {
            this.goToOnboarding(true);
        }
    }

    private accountSelected(walletId: string, address: string) {
        const walletInfo = this.findWallet(walletId);
        if (!walletInfo) {
            console.error('Selected account not found:', walletId);
            return;
        }

        const accountInfo = walletInfo.accounts.get(address);
        if (!accountInfo) {
            console.error('Selected address not found:', address);
            return;
        }

        this.$store.commit('setActiveAccount', {
            walletId: walletInfo.id,
            userFriendlyAddress: accountInfo.userFriendlyAddress,
        });

        const result: ChooseAddressResult = {
            address: accountInfo.userFriendlyAddress,
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

    @Emit()
    private close() {
        this.$rpc.reject(new Error(ERROR_CANCELED));
    }
}
</script>

<style scoped>
    .small-page {
        position: relative;
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
