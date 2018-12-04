<template>
    <div class="container pad-bottom">
        <SmallPage>
            <PageHeader :progressIndicator="true" :numberSteps="numberSteps" :step="numberSteps">
                Your wallet is ready
            </PageHeader>
            <PageBody>
                <div class="success-box nq-icon trumpet nq-bg-green">
                    <h2 class="nq-h2">Awesome!</h2>
                    <p class="nq-text">Your Keyguard Wallet is set up. It already contains your newly created account.</p>
                    <p class="nq-text">You can add more accounts to it later.</p>
                </div>

                <div class="wallet-label">
                    <div class="wallet-icon nq-icon" :class="walletIconClass"></div>
                    <LabelInput :value="walletLabel" @changed="onWalletLabelChange"/>
                </div>

                <Account :address="createdAddress.toUserFriendlyAddress()" :label="accountLabel" :editable="true"
                         @changed="onAccountLabelChange" v-if="!!createdAddress"/>

                <button class="nq-button green submit" @click="done()">Open your wallet</button>
            </PageBody>
        </SmallPage>
    </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';
import { Account, LabelInput, PageBody, PageHeader, SmallPage } from '@nimiq/vue-components';
import { AccountInfo } from '../lib/AccountInfo';
import { WalletInfo, WalletType } from '../lib/WalletInfo';
import { State } from 'vuex-class';
import { WalletStore } from '../lib/WalletStore';
import { CreateResult } from '@nimiq/keyguard-client';
import { SignupResult } from '@/lib/RequestTypes';

@Component({components: {PageHeader, PageBody, Account, LabelInput, SmallPage}})
export default class SignupSuccess extends Vue {
    private static readonly STEPS_KEYGUARD_SIGNUP = 6;
    private static readonly STEPS_LEDGER_SIGNUP = 3;
    private static readonly DEFAULT_KEYGUARD_WALLET_LABEL = 'Keyguard Wallet';
    private static readonly DEFAULT_LEDGER_WALLET_LABEL = 'Ledger Wallet';
    private static readonly DEFAULT_KEYGUARD_ACCOUNT_LABEL = 'Standart Account';
    private static readonly DEFAULT_LEDGER_ACCOUNT_LABEL = 'Ledger Account';

    @Prop({ default: null })
    public createResult!: CreateResult;

    @State private keyguardResult?: CreateResult;

    private numberSteps!: number;
    private walletType!: WalletType;
    private walletLabel!: string;
    private accountLabel!: string;
    private createdAddress: Nimiq.Address | null = null;

    private get walletIconClass(): string {
        return this.walletType === WalletType.BIP39 ? 'keyguard' : 'ledger';
    }

    private created() {
        if (this.keyguardResult) {
            this.createResult = this.keyguardResult;
            this.walletType = WalletType.BIP39;
            this.numberSteps = SignupSuccess.STEPS_KEYGUARD_SIGNUP;
            this.walletLabel = SignupSuccess.DEFAULT_KEYGUARD_WALLET_LABEL;
            this.accountLabel = SignupSuccess.DEFAULT_KEYGUARD_ACCOUNT_LABEL;
        } else {
            if (!this.createResult) throw new Error('SignupSuccess shown without createResult');
            this.walletType = WalletType.LEDGER;
            this.numberSteps = SignupSuccess.STEPS_LEDGER_SIGNUP;
            this.walletLabel = SignupSuccess.DEFAULT_LEDGER_WALLET_LABEL;
            this.accountLabel = SignupSuccess.DEFAULT_LEDGER_ACCOUNT_LABEL;
        }
        this.createdAddress = new Nimiq.Address(this.createResult.address);
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
            walletId: this.createResult.keyId,
            label: this.walletLabel,
            type: this.walletType,
            accounts: [{
                address: this.createdAddress!.toUserFriendlyAddress(),
                label: this.accountLabel,
            }],
        };

        this.$rpc.resolve(result);
    }

    private async saveResult(walletLabel: string, accountLabel: string) {
        const accountInfo = new AccountInfo(
            this.createResult.keyPath,
            accountLabel,
            this.createdAddress!,
        );

        const walletInfo = new WalletInfo(
            this.createResult.keyId,
            walletLabel,
            new Map<string, AccountInfo>().set(accountInfo.userFriendlyAddress, accountInfo),
            [],
            this.walletType,
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
