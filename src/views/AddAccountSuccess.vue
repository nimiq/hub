<template>
    <div class="container">
        <SmallPage>
            <PageHeader>Your account is ready</PageHeader>
            <PageBody>
                <div class="success-box nq-icon trumpet nq-bg-green">
                    <h2 class="nq-h2">Awesome!</h2>
                    <p class="nq-text">Your new account has been added to your wallet.</p>
                </div>

                <div class="login-label">
                    <div class="login-icon nq-icon" :class="walletIconClass"></div>
                    {{ walletLabel }}
                </div>

                <Account :address="createdAddress.toUserFriendlyAddress()" :label="accountLabel" :editable="true" @changed="onAccountLabelChange"/>

                <button class="nq-button green submit" @click="done()">Open your account</button>
            </PageBody>
        </SmallPage>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { PageHeader, PageBody, Account, LabelInput, SmallPage } from '@nimiq/vue-components';
import { AccountInfo } from '../lib/AccountInfo';
import { WalletInfo, WalletType } from '../lib/WalletInfo';
import { State, Getter } from 'vuex-class';
import { WalletStore } from '../lib/WalletStore';
import { DeriveAddressResult, DeriveAddressRequest } from '@nimiq/keyguard-client';
import { ResponseStatus, State as RpcState } from '@nimiq/rpc';
import { AddAccountRequest, AddAccountResult } from '@/lib/RequestTypes';
import { Static } from '../lib/StaticStore';

@Component({components: {PageHeader, PageBody, Account, LabelInput, SmallPage}})
export default class AddAccountSuccess extends Vue {
    @Static private rpcState!: RpcState;
    @Static private request!: AddAccountRequest;
    @State private keyguardResult!: DeriveAddressResult;

    private walletLabel: string = '';
    private accountLabel: string = 'Standard Account';
    private createdAddress: Nimiq.Address | null = null;

    private get walletIconClass(): string {
        return 'keyguard';
    }

    private created() {
        this.createdAddress = new Nimiq.Address(this.keyguardResult.address);
        this.saveResult(this.accountLabel);
    }

    private onAccountLabelChange(label: string) {
        this.accountLabel = label;
        this.saveResult(this.accountLabel);
    }

    private async done() {
        const result: AddAccountResult = {
            walletId: this.request.walletId,
            account: {
                address: this.createdAddress!.toUserFriendlyAddress(),
                label: this.accountLabel,
            },
        };

        this.rpcState.reply(ResponseStatus.OK, result);
    }

    private async saveResult(accountLabel: string) {
        const wallet = await WalletStore.Instance.get(this.request.walletId);
        if (!wallet) throw new Error('Wallet ID not found');

        this.walletLabel = wallet.label;

        const newAccount = new AccountInfo(
            this.keyguardResult.keyPath,
            accountLabel,
            this.createdAddress!,
        );

        wallet.accounts.set(this.createdAddress!.toUserFriendlyAddress(), newAccount);

        await WalletStore.Instance.put(wallet);
    }
}
</script>

<style scoped>
    .small-page {
        margin-bottom: 15rem;
    }

    .page-body {
        padding: 1rem 0 4rem 0;
    }

    .success-box {
        padding: 5rem 4rem;
        overflow: auto;
        margin: 0 1rem;
        border-radius: 0.5rem;
        background-position: calc(100% - 2rem) center;
        background-size: auto 15.125rem;
        display: block;
        width: unset;
        height: unset;
    }

    .success-box p {
        width: 25rem;
        opacity: 1;
    }

    .success-box p + p {
        width: 20rem;
    }

    .login-label {
        display: flex;
        flex-direction: row;
        justify-content: flex-start;
        align-items: center;
        font-size: 2.25rem;
        line-height: 2.5rem;
        font-weight: 500;
        margin: 2rem 3rem 0;
        padding: 2rem 1rem;
        border-bottom: solid 1px rgba(0, 0, 0, 0.1);
    }

    .login-icon {
        height: 3rem;
        width: 3rem;
        flex-shrink: 0;
        margin-right: 1rem;
    }
</style>
