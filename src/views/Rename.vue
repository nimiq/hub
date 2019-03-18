<template>
    <div class="container">
        <SmallPage class="rename">
            <PageHeader>Rename your Account</PageHeader>
            <PageBody v-if="wallet">
                <div class="wallet-label" v-if="wallet.type !== 1 /* LEGACY */">
                    <div class="wallet-icon nq-icon" :class="walletIconClass"></div>
                    <Input :value="wallet.label" @changed="onWalletLabelChange" ref="wallet"/>
                </div>

                <AccountList ref="accountList"
                    :walletId="wallet.id"
                    :accounts="accounts"
                    :editable="true"
                    @account-changed="accountChanged"/>
            </PageBody>
            <PageFooter>
                <button class="nq-button" @click="storeLabels">Save</button>
            </PageFooter>
            <transition name='fade-in'>
                <Loader v-if="labelsStored"
                    state="success"
                    title="All labels saved."/>
            </transition>
        </SmallPage>

        <button class="global-close nq-button-s" :class="{'hidden': labelsStored}" @click="close">
            <span class="nq-icon arrow-left"></span>
            Cancel Renaming
        </button>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Emit } from 'vue-property-decorator';
import { AccountList, SmallPage, PageHeader, PageBody, PageFooter } from '@nimiq/vue-components';
import Input from '@/components/Input.vue';
import { ParsedRenameRequest } from '../lib/RequestTypes';
import { Account } from '../lib/PublicRequestTypes';
import Loader from '../components/Loader.vue';
import { WalletInfo, WalletType } from '../lib/WalletInfo';
import { WalletStore } from '@/lib/WalletStore';
import { Static } from '../lib/StaticStore';
import { ERROR_CANCELED } from '@/lib/Constants';

/*
    In Case some sort auf Authentication with the wallet is desireable, there are 2 options:
        1.  is to have the user enter the password at the very beginning. This would require the AccountsManager to
            first redirect to the Keyguard. After returning and validating (sign message) this component would come
            into view.
        2.  is to have the user enter his Password as confirmation of the changes (sign message and validate). That
            would move the storeLabels function into a RenameSuccess Component where the store and return happens.
*/

@Component({components: {
    SmallPage,
    PageHeader,
    PageBody,
    PageFooter,
    AccountList,
    Input,
    Loader,
}})
export default class Rename extends Vue {
    @Static private request!: ParsedRenameRequest;

    private wallet: WalletInfo | null = null;
    private labelsStored: boolean = false;

    private get accounts() {
        if (!this.wallet) return [];
        return Array.from(this.wallet.accounts.values());
    }

    private get walletIconClass() {
        if (!this.wallet) return '';
        switch (this.wallet.type) {
            case WalletType.LEGACY: return 'keyguard';
            case WalletType.BIP39: return 'keyguard';
            case WalletType.LEDGER: return 'ledger';
        }
    }

    private async mounted() {
        const wallet = await WalletStore.Instance.get(this.request.walletId);
        if (!wallet) throw new Error('Account ID not found');

        this.wallet = wallet;
        // Wait for the next tick to update the DOM, then focus the correct label
        Vue.nextTick(this.focusElement);

    }

    private focusElement() {
        if (this.request.address) { // Account with address this.request.address was selected
            const el = (this.$refs.accountList as AccountList);
            el.focus(this.request.address);
        } else { // A wallet was selected
            if (this.wallet!.type !== WalletType.LEGACY) {
                const el = (this.$refs.wallet as Input);
                el.focus();
            }
        }
    }

    private accountChanged(address: string, label: string) {
        const addressInfo = this.wallet!.accounts.get(address);
        if (!addressInfo) throw new Error('UNEXPECTED: Address that was changed does not exist');
        addressInfo.label = label;
        this.wallet!.accounts.set(address, addressInfo);
    }

    private onWalletLabelChange(label: string) {
        this.wallet!.label = label;
    }

    private storeLabels() {
        WalletStore.Instance.put(this.wallet!);
        this.labelsStored = true;

        setTimeout(() => this.done(), Loader.SUCCESS_REDIRECT_DELAY);
    }

    private done() {
        const result: Account = {
            accountId: this.wallet!.id,
            label: this.wallet!.label,
            type: this.wallet!.type,
            addresses: Array.from(this.accounts.values()).map((addressInfo) => ({
                address: addressInfo.userFriendlyAddress,
                label: addressInfo.label,
            })),
        };

        this.$rpc.resolve(result);
    }

    @Emit()
    private close() {
        this.$rpc.reject(new Error(ERROR_CANCELED));
    }
}
</script>

<style scoped>
    .rename {
        position: relative;
    }

    .page-body {
        padding: 0;
    }

    .page-footer {
        padding: 1rem;
    }

    .wallet-icon {
        width: 3rem;
        height: 3rem;
        margin-right: 1rem;
    }

    .wallet-label {
        display: flex;
        flex-direction: row;
        justify-content: flex-start;
        align-items: center;
        font-size: 2.25rem;
        line-height: 2.5rem;
        font-weight: 500;
        margin: 2rem 3rem 0;
        padding: 2rem 1rem;
    }

    .loader {
        position: absolute;
        bottom: 0;
        left: 0;
        height: calc(100% - 1.5rem);
        width: calc(100% - 1.5rem);
        overflow: hidden;
        white-space: nowrap;
    }

    .fade-in-enter-active {
        animation: grow-from-button .5s;
    }

    @keyframes grow-from-button {
        0% {
            max-height: 8rem;
            max-width: 8rem;
            border-radius: 4rem;
            bottom: 6rem;
            left: calc(50% - 4rem);
        }

        25% {
            max-width: calc(100% - 1.5rem);
            left: 0;
        }

        50% {
            bottom: 0;
        }

        100% {
            max-height: calc(100% - 1.5rem);
            border-radius: 0.5rem;
        }
    }
</style>
