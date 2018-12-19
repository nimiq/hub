<template>
    <div class="container">
        <AccountSelector
                :wallets="processedWallets"
                @account-selected="accountSelected"
                @login="goToOnboarding"/>

        <button class="global-close nq-button-s" @click="close">
            <span class="nq-icon arrow-left"></span>
            Back to {{request.appName}}
        </button>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { State, Mutation } from 'vuex-class';
import { AccountSelector } from '@nimiq/vue-components';
import { SimpleRequest } from '../lib/RequestTypes';
import { Static } from '../lib/StaticStore';
import { WalletInfo, WalletType } from '../lib/WalletInfo';
import { AccountInfo } from '../lib/AccountInfo';
import { TX_VALIDITY_WINDOW, LEGACY_GROUPING_WALLET_ID, LEGACY_GROUPING_WALLET_LABEL } from '../lib/Constants';

@Component({components: { AccountSelector }})
export default class ChooseAddress extends Vue {
    @Static private request!: SimpleRequest;
    @State private wallets!: WalletInfo[];

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
