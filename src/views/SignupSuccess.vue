<template>
    <div class="container pad-bottom">
        <SmallPage>
            <PageHeader :progressIndicator="true" :numberSteps="6" :step="6">Your wallet is ready</PageHeader>
            <PageBody>
                <div class="success-box nq-icon trumpet nq-green-bg">
                    <h2 class="nq-h2">Awesome!</h2>
                    <p class="nq-text">Your Keyguard Wallet is set up. It already contains your newly created account.</p>
                    <p class="nq-text">You can add more accounts to it later.</p>
                </div>

                <div class="wallet-label">
                    <div class="wallet-icon nq-icon" :class="walletIconClass"></div>
                    <Input :value="walletLabel" @changed="onWalletLabelChange"/>
                </div>

                <Account :address="createdAddress.toUserFriendlyAddress()" :label="accountLabel" :editable="true" @changed="onAccountLabelChange"/>

                <button class="nq-button green submit" @click="done()">Open your wallet</button>
            </PageBody>
        </SmallPage>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { PageHeader, PageBody, Account, SmallPage } from '@nimiq/vue-components';
import { AccountInfo } from '../lib/AccountInfo';
import { WalletInfo, WalletType } from '../lib/WalletInfo';
import { State, Getter } from 'vuex-class';
import { WalletStore } from '../lib/WalletStore';
import { CreateResult } from '@nimiq/keyguard-client';
import { SignupResult } from '@/lib/RequestTypes';
import Input from '@/components/Input.vue';

@Component({components: {PageHeader, PageBody, Account, Input, SmallPage}})
export default class SignupSuccess extends Vue {
    @State private keyguardResult!: CreateResult;
    @State private activeAccountPath!: string;
    @Getter private hasWallets!: boolean;

    private walletLabel: string = 'Keyguard Wallet';
    private accountLabel: string = 'Standard Account';
    private createdAddress: Nimiq.Address | null = null;

    private get walletIconClass(): string {
        return 'keyguard';
    }

    private created() {
        this.createdAddress = new Nimiq.Address(this.keyguardResult.address);
        this.saveResult(this.walletLabel, this.accountLabel);
    }

    private onWalletLabelChange(label: string) {
        console.log(label);
        this.walletLabel = label;
        this.saveResult(this.walletLabel, this.accountLabel);
    }

    private onAccountLabelChange(label: string) {
        console.log(label);
        this.accountLabel = label;
        this.saveResult(this.walletLabel, this.accountLabel);
    }

    private async done() {
        const result: SignupResult = {
            walletId: this.keyguardResult.keyId,
            label: this.walletLabel,
            type: WalletType.BIP39, // FIXME: Adapt when adding Ledger
            accounts: [{
                address: this.createdAddress!.toUserFriendlyAddress(),
                label: this.accountLabel,
            }],
        };

        this.$rpc.resolve(result);
    }

    private async saveResult(walletLabel: string, accountLabel: string) {
        const accountInfo = new AccountInfo(
            this.keyguardResult.keyPath,
            accountLabel,
            this.createdAddress!,
        );

        const walletInfo = new WalletInfo(
            this.keyguardResult.keyId,
            walletLabel,
            new Map<string, AccountInfo>().set(accountInfo.userFriendlyAddress, accountInfo),
            [],
            WalletType.BIP39,
        );

        await WalletStore.Instance.put(walletInfo);
    }
}
</script>

<style scoped>
    .page-body {
        padding: 1rem 0 4rem;
    }

    .success-box {
        padding: 3rem 4rem;
        overflow: auto;
        margin: 0 1rem;
        border-radius: 0.5rem;
        background-position: calc(100% - 2rem) center;
        background-size: auto 21.125rem;
        display: block;
        width: unset;
        height: unset;
    }

    .success-box p {
        width: 28rem;
        opacity: 1;
    }

    .success-box p + p {
        width: 24rem;
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
        border-bottom: solid 1px var(--nimiq-card-border-color);
    }

    .wallet-icon {
        height: 3rem;
        width: 3rem;
        flex-shrink: 0;
        margin-right: 1rem;
    }
</style>
