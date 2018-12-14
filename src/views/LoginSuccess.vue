<template>
    <div class="container pad-bottom">
        <SmallPage>
            <div class="login-success">
                <PageHeader>Your wallet is ready</PageHeader>

                <PageBody>
                    <div class="wallet-label" v-if="walletInfo && keyguardResult.keyType !== 0 /* LEGACY */">
                        <div class="wallet-icon nq-icon" :class="walletIconClass"></div>
                        <Input :value="walletInfo.label" @changed="onWalletLabelChange"/>
                    </div>

                    <AccountList v-if="walletInfo" :accounts="accountsArray"
                                 :editable="true" @account-changed="onAccountLabelChanged"/>

                    <Loader class="small" :title="''" :status="statusMessage" v-if="!retrievalComplete"></Loader>
                </PageBody>

                <PageFooter>
                    <button class="nq-button" @click="done">Back to {{ appName }}</button>
                </PageFooter>
            </div>
        </SmallPage>
    </div>
</template>

<script lang="ts">
import { Component, Emit, Vue } from 'vue-property-decorator';
import { ParsedLoginRequest, OnboardingResult, RequestType } from '../lib/RequestTypes';
import { State } from 'vuex-class';
import { WalletInfo, WalletType } from '../lib/WalletInfo';
import { ImportResult } from '@nimiq/keyguard-client';
import { WalletStore } from '@/lib/WalletStore';
import staticStore, { Static } from '@/lib/StaticStore';
import { PageHeader, PageBody, AccountList, PageFooter, SmallPage } from '@nimiq/vue-components';
import Loader from '@/components/Loader.vue';
import WalletInfoCollector from '@/lib/WalletInfoCollector';
import Input from '@/components/Input.vue';

@Component({components: {PageHeader, PageBody, Input, AccountList, Loader, PageFooter, SmallPage}})
export default class LoginSuccess extends Vue {
    @Static private request!: ParsedLoginRequest;
    @State private keyguardResult!: ImportResult;

    private walletInfo: WalletInfo | null = null;

    /**
     * Used to invalidate the cached value for getter `accountsArray`.
     */
    private updateCount: number = 0;

    private retrievalFailed: boolean = false;
    private retrievalComplete: boolean = false;

    private async mounted() {
        // The Keyguard always returns (at least) one derived Address,
        const keyguardResultAccounts = this.keyguardResult.addresses.map((addressObj) => ({
            address: new Nimiq.Address(addressObj.address).toUserFriendlyAddress(),
            path: addressObj.keyPath,
        }));

        let tryCount = 0;
        while (true) {
            try {
                tryCount += 1;
                await WalletInfoCollector.collectWalletInfo(
                    this.keyguardResult.keyType,
                    this.keyguardResult.keyId,
                    keyguardResultAccounts,
                    (updatedWalletInfo) => this._onWalletInfoUpdate(updatedWalletInfo),
                );
                this.retrievalFailed = false;
                break;
            } catch (e) {
                this.retrievalFailed = true;
                if (tryCount >= 5) throw e;
            }
        }

        // TODO network visuals with longer than 1 list of accounts during retrieval
        this.retrievalComplete = true;
    }

    private _onWalletInfoUpdate(walletInfo: WalletInfo) {
        this.walletInfo = walletInfo;
        this.storeAndRender();
    }

    private onWalletLabelChange(label: string) {
        this.walletInfo!.label = label;
        this.storeAndRender();
    }

    private onAccountLabelChanged(address: string, label: string) {
        const addressInfo = this.walletInfo!.accounts.get(address);
        if (!addressInfo) throw new Error('UNEXPECTED: Address that was changed does not exist');
        addressInfo.label = label;
        this.storeAndRender();
    }

    private storeAndRender() {
        WalletStore.Instance.put(this.walletInfo!);
        this.updateCount += 1; // Trigger DOM update via computed property `this.accountsArray`
    }

    @Emit()
    private done() {
        if (!this.walletInfo) throw new Error('WalletInfo not ready.');
        const result: OnboardingResult = {
            walletId: this.walletInfo.id,
            label: this.walletInfo.label,
            type: this.walletInfo.type,
            accounts: Array.from(this.walletInfo.accounts.values()).map((addressInfo) => ({
                address: addressInfo.userFriendlyAddress,
                label: addressInfo.label,
            })),
        };
        this.$rpc.resolve(result);
    }

    private get walletIconClass(): string {
        return this.keyguardResult.keyType === WalletType.LEDGER ? 'ledger' : 'keyguard';
    }

    private get accountsArray(): Array<{ label: string, address: Nimiq.Address, balance?: number }> {
        if (this.updateCount && this.walletInfo) return Array.from(this.walletInfo.accounts.values());
        return [];
    }

    private get statusMessage() {
        return !this.retrievalFailed ? 'Detecting your Accounts' : 'Account retrieval failed. Retrying...';
    }

    private get appName() {
        if (staticStore.originalRouteName) {
            switch (staticStore.originalRouteName) {
                case RequestType.CHECKOUT: return 'Checkout';
                default: throw new Error('Unhandled originalRouteName');
            }
        }
        return this.request.appName;
    }
}
</script>

<style scoped>
    .login-success {
        display: flex;
        flex-direction: column;
        flex-grow: 1;
    }

    .page-body {
        padding: 0;
    }

    .wallet-label {
        display: flex;
        flex-direction: row;
        justify-content: flex-start;
        align-items: center;
        font-size: 2.25rem;
        line-height: 2.5rem;
        font-weight: 500;
        margin: 0 3rem;
        padding: 2rem 1rem 1.5rem;
        border-bottom: solid .125rem var(--nimiq-card-border-color);
    }

    .wallet-icon {
        height: 3rem;
        width: 3rem;
        flex-shrink: 0;
        margin-right: 1rem;
    }

    .loader {
        min-height: 21rem;
    }

    .page-footer {
        padding: 1rem;
    }
</style>
