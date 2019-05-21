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
                @login="() => goToOnboarding(false)"/>

        </SmallPage>

        <button class="global-close nq-button-s" @click="close">
            <ArrowLeftSmallIcon/>
            Back to {{request.appName}}
        </button>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { Getter, Mutation } from 'vuex-class';
import { SmallPage, AccountSelector, ArrowLeftSmallIcon } from '@nimiq/vue-components';
import { RequestType } from '../lib/RequestTypes';
import { SimpleRequest, Account, Address } from '../lib/PublicRequestTypes';
import staticStore, { Static } from '@/lib/StaticStore';
import { WalletStore } from '@/lib/WalletStore';
import { WalletInfo } from '../lib/WalletInfo';
import { CanceledError } from '../lib/Errors';
import { AccountInfo } from '../lib/AccountInfo';
import { ContractInfo } from '../lib/ContractInfo';

@Component({components: { AccountSelector, SmallPage, ArrowLeftSmallIcon }})
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

        const accountOrContractInfo: AccountInfo | ContractInfo = walletInfo.accounts.get(address) ||
            walletInfo.findContractByAddress(Nimiq.Address.fromUserFriendlyAddress(address))!;

        this.$setActiveAccount({
            walletId: walletInfo.id,
            userFriendlyAddress: accountOrContractInfo.userFriendlyAddress,
        });

        const result: Address = {
            address: accountOrContractInfo.userFriendlyAddress,
            label: accountOrContractInfo.label,
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
            const sideResult = staticStore.sideResult as Account[];

            // Add imported wallets to Vuex store
            for (const account of sideResult) {
                const walletInfo = await WalletStore.Instance.get(account.accountId);
                if (walletInfo) {
                    this.$addWallet(walletInfo);

                    // Set as activeWallet and activeAccount
                    // FIXME: Also handle active account we get from store
                    const activeAccount = walletInfo.accounts.values().next().value;

                    this.$setActiveAccount({
                        walletId: walletInfo.id,
                        userFriendlyAddress: activeAccount.userFriendlyAddress,
                    });
                }
            }
        }
        delete staticStore.sideResult;
    }

    private close() {
        this.$rpc.reject(new CanceledError());
    }
}
</script>

<style scoped>
    .small-page {
        position: relative;
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
