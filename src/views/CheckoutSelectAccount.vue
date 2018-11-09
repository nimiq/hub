<template>
    <div class="visible-area">
        <div class="multi-pages" :style="`transform: translate3d(-${(page - 1) * 100}%, 0, 0)`">
            <WalletSelector @wallet-selected="walletSelected"
                            @account-selected="accountSelected"
                            @add-wallet="addWallet"
                            @back="backToOverview"
                            :wallets="wallets"/>
            <AccountSelector
                    @account-selected="accountSelected"
                    @switch-wallet="switchWallet"
                    @back="switchWallet"
                    :accounts="currentAccounts"
                    :walletId="currentWallet ? currentWallet.id : ''"
                    :walletLabel="currentWallet ? currentWallet.label : ''"
                    :walletType="currentWallet ? currentWallet.type : 0"
                    :show-switch-wallet="!!this.preselectedWalletId"/>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Emit, Vue } from 'vue-property-decorator';
import { AccountSelector, WalletSelector } from '@nimiq/vue-components';
import { AccountInfo } from '../lib/AccountInfo';
import { WalletInfo, WalletType } from '../lib/WalletInfo';
import { RequestType } from '../lib/RequestTypes';
import { State, Mutation } from 'vuex-class';

@Component({components: {AccountSelector, WalletSelector}})
export default class CheckoutSelectAccount extends Vue {
    @State('wallets') private wallets!: WalletInfo[];

    @Mutation('addKey') private addKey!: (key: WalletInfo) => any;

    private page: number = 1;
    private selectedWalletId: string | null = null;
    private preselectedWalletId: string | null = null;

    private created() {
        if (this.wallets.length === 1) {
            this.preselectedWalletId = this.wallets[0].id;
            this.page = 2;
        }
    }

    private get currentWallet() {
        const walletId = this.selectedWalletId || this.preselectedWalletId || false;
        if (!walletId) return undefined;
        return this.wallets.find((k) => k.id === walletId);
    }

    private get currentAccounts() {
        const wallet = this.currentWallet;
        if (!wallet) return [];
        return Array.from(wallet.accounts.values());
    }

    private walletSelected(walletId: string) {
        this.selectedWalletId = walletId;
        this.page = 2;
    }

    private switchWallet() {
        // TODO Redirect to import/create just like addWallet()

        this.page = 1;
    }

    @Emit()
    private addWallet() {
        // TODO Redirect to import/create

        const id: string = Math.round(Math.pow(2, 32) * Math.random()).toString(16);
        const map = new Map<string, AccountInfo>();
        map.set('NQ09 VF5Y 1PKV MRM4 5LE1 55KV P6R2 GXYJ XYQF', new AccountInfo(
            'a',
            'My Account',
            Nimiq.Address.fromString('NQ09 VF5Y 1PKV MRM4 5LE1 55KV P6R2 GXYJ XYQF'),
        ));
        this.addKey(new WalletInfo(id, id, map, [], WalletType.LEDGER));
    }

    @Emit()
    private accountSelected(walletId: string, address: string) {
        const key = this.wallets.find((k: WalletInfo) => k.id === walletId);
        if (!key) {
            console.error('Selected Key not found:', walletId);
            return;
        }

        const addressInfo = Array.from(key.accounts.values())
            .find((ai: AccountInfo) => ai.userFriendlyAddress === address);
        if (!addressInfo) {
            console.error('Selected AccountInfo not found:', address);
            return;
        }

        this.$store.commit('setActiveAccount', {
            walletId: key.id,
            userFriendlyAddress: addressInfo.userFriendlyAddress,
        });

        // Return to overview
        this.backToOverview();
    }

    private backToOverview() {
        this.$router.push({name: RequestType.CHECKOUT});
    }
}
</script>

<style scoped>
    .visible-area {
        overflow: hidden;
        flex: 1;
        display: flex
    }

    .multi-pages {
        position: relative;
        flex: 1;
        display: grid;
        grid-template-columns: 100% 100%;
        will-change: transform;
        transition: all 400ms ease-in-out;
    }
</style>
