<template>
    <div class="container pad-bottom">
        <SmallPage>
            <IdenticonSelector  v-if="!showStatusScreen" :accounts="accounts" @identicon-selected="identiconSelected">
                <PageHeader slot="header" backArrow @back="back">Choose a new Account</PageHeader>
            </IdenticonSelector>

            <StatusScreen v-else class="grow-from-bottom-button" :title="title" :state="state" :lightBlue="true">
                <template slot="success">
                    <CheckmarkIcon/>
                    <h1 class="title nq-h1">New Address added<br>to your Account.</h1>
                </template>
            </StatusScreen>
        </SmallPage>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { SmallPage, PageHeader, CheckmarkIcon } from '@nimiq/vue-components';
import IdenticonSelector from '../components/IdenticonSelector.vue';
import { AccountInfo } from '../lib/AccountInfo';
import { State } from 'vuex-class';
import { WalletStore } from '../lib/WalletStore';
import { DerivedAddress } from '@nimiq/keyguard-client';
import { ParsedSimpleRequest } from '../lib/RequestTypes';
import { Address } from '../lib/PublicRequestTypes';
import StatusScreen from '../components/StatusScreen.vue';
import { Static } from '../lib/StaticStore';

@Component({components: {StatusScreen, SmallPage, PageHeader, IdenticonSelector, CheckmarkIcon}})
export default class AddAccountSelection extends Vue {
    @Static private request!: ParsedSimpleRequest;
    @State private keyguardResult!: DerivedAddress[];

    private showStatusScreen: boolean = false;
    private state: StatusScreen.State = StatusScreen.State.LOADING;
    private title: string = 'Storing your Address';

    private get accounts(): AccountInfo[] {
        return this.keyguardResult.map((address) => new AccountInfo(
            address.keyPath,
            '',
            new Nimiq.Address(address.address),
        ));
    }

    private back() {
        window.history.back();
    }

    private async identiconSelected(selectedAccount: AccountInfo) {
        this.showStatusScreen = true;

        const wallet = (await WalletStore.Instance.get(this.request.walletId))!;

        if (!selectedAccount.label) {
            selectedAccount.label = selectedAccount.defaultLabel;
        }

        wallet.accounts.set(selectedAccount.userFriendlyAddress, selectedAccount);

        await WalletStore.Instance.put(wallet);
        // Artificially delay, to display loading status
        await new Promise((res) => setTimeout(res, 1000));

        this.state = StatusScreen.State.SUCCESS;

        const result: Address = {
            address: selectedAccount.userFriendlyAddress,
            label: selectedAccount.label,
        };

        setTimeout(() => this.$rpc.resolve(result), StatusScreen.SUCCESS_REDIRECT_DELAY);
    }
}
</script>

<style scoped>
    .small-page {
        position: relative;
    }
</style>
