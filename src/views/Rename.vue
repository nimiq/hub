<template>
    <div class="container pad-bottom">
        <SmallPage>
            <PageHeader>Rename your Wallet</PageHeader>
            <PageBody v-if="wallet">
                <div class="wallet-label">
                    <div class="wallet-icon nq-icon" :class="walletIconClass"></div>
                    <LabelInput :value="wallet.label" @changed="onWalletLabelChange" ref="wallet"/>
                </div>

                <AccountList ref="accountList"
                    :walletId="wallet.id"
                    :accounts="accounts"
                    :editable="true"
                    @account-changed="accountChanged"/>
            </PageBody>
            <PageFooter>
                <button class="nq-button" @click="done">Done</button>
            </PageFooter>
        </SmallPage>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { AccountList, LabelInput, SmallPage, PageHeader, PageBody, PageFooter } from '@nimiq/vue-components';
import { ParsedRenameRequest, RenameResult } from '../lib/RequestTypes';
import { ResponseStatus, State as RpcState } from '@nimiq/rpc';
import { WalletInfo } from '../lib/WalletInfo';
import { WalletStore } from '@/lib/WalletStore';
import staticStore, { Static } from '../lib/StaticStore';

/*
    In Case some sort auf Authentication with the wallet is desireable, there are 2 options:
        1.  is to have the user enter the password at the very beginning. This would require the Accountsmanager to
            first redirect to the Keyguard. after eturning and validateing (Sign Message?) this Component would come into view.
        2.  is to have the user enter his Password as confirmation of the changes. That would move the done function into a
            RenameSuccess Component where the store and return happens.
*/

@Component({components: {
    SmallPage,
    PageHeader,
    PageBody,
    PageFooter,
    AccountList,
    LabelInput,
}})
export default class Rename extends Vue {
    @Static private request!: ParsedRenameRequest;
    @Static private rpcState!: RpcState;

    private wallet: WalletInfo | null = null;

    private get accounts() {
        if (!this.wallet) return [];
        return Array.from(this.wallet.accounts.values());
    }

    private get walletIconClass() {
        if (!this.wallet) return '';
        switch (this.wallet.type) {
            case 0: return 'keyguard'; // Legacy
            case 1: return 'keyguard';
            case 2: return 'ledger';
        }
    }

    public async mounted() {
        const wallet = await WalletStore.Instance.get(this.request.walletId);
        if (!wallet) throw new Error('Wallet ID not found');

        this.wallet = wallet;
        // wait for the next tick to update the dom, after that focus the correct label
        Vue.nextTick(this.focusElement);

    }
    public focusElement() {
        if (this.request.address) { // account with address this.request.address was selected
            const el = (this.$refs.accountList as AccountList);
            el.focus(this.request.address);
        } else { // wallet was selected
            const el = (this.$refs.wallet as LabelInput);
            el.focus();
        }
    }

    private accountChanged(address: string, label: string) {
        if (!this.wallet) throw new Error('Wallet ID not found');

        const addressInfo = this.wallet.accounts.get(address);
        if (!addressInfo) throw new Error('UNEXPECTED: Address that was changed does not exist');
        addressInfo.label = label;
        this.wallet.accounts.set(address, addressInfo);
    }

    private onWalletLabelChange(label: string) {
        if (!this.wallet) throw new Error('Wallet ID not found');

        this.wallet.label = label;
    }

    private done() {
        if (!this.wallet) throw new Error('Wallet ID not found');

        WalletStore.Instance.put(this.wallet);

        const result = {
            walletId: this.wallet.id,
            label: this.wallet.label,
            accounts: Array.from(this.accounts.values()).map((addressInfo) => ({
                address: addressInfo.userFriendlyAddress,
                label: addressInfo.label,
            })),
        } as RenameResult;

        this.rpcState.reply(ResponseStatus.OK, result);
    }
}
</script>
