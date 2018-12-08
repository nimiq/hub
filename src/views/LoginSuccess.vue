<template>
    <div class="container pad-bottom">
        <SmallPage>
            <div class="login-success">
                <PageHeader>Your wallet is ready</PageHeader>

                <PageBody>
                    <div class="wallet-label" v-if="contentReady && keyguardResult.keyType !== 0 /* LEGACY */">
                        <div class="wallet-icon nq-icon" :class="walletIconClass"></div>
                        <LabelInput :value="walletLabel" @changed="onWalletLabelChange"/>
                    </div>

                    <AccountList v-if="contentReady" :accounts="accountsArray" :editable="true" @account-changed="onAccountLabelChanged"/>

                    <div class="network-wrapper">
                        <Network :alwaysVisible="keyguardResult.keyType !== 0 /* LEGACY */ && !retrievalComplete" :message="'Detecting your accounts'" ref="network"/>
                    </div>
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
import { ParsedLoginRequest, LoginResult, RequestType } from '../lib/RequestTypes';
import { State } from 'vuex-class';
import { WalletInfo, WalletType } from '../lib/WalletInfo';
import { ImportResult, KeyguardClient } from '@nimiq/keyguard-client';
import { AccountInfo } from '@/lib/AccountInfo';
import { WalletStore } from '@/lib/WalletStore';
import staticStore, { Static } from '@/lib/StaticStore';
import { PageHeader, PageBody, LabelInput, AccountList, PageFooter, SmallPage } from '@nimiq/vue-components';
import Network from '@/components/Network.vue';
import AccountFinder from '../lib/AccountFinder';

@Component({components: {PageHeader, PageBody, LabelInput, AccountList, Network, PageFooter, SmallPage}})
export default class LoginSuccess extends Vue {
    private static readonly DEFAULT_ACCOUNT_LABEL: string = 'Standard Account';

    @Static private request!: ParsedLoginRequest;
    @State private keyguardResult!: ImportResult;

    private keyguard!: KeyguardClient;
    private network!: Network;

    private walletInfo: WalletInfo | null = null;

    private walletLabel: string = 'Keyguard Wallet';

    /**
     * Maps are not supported by Vue's reactivity system, thus updates to a Map do not trigger
     * an update of the DOM. To work around that, a second reactive attribute is added (a plain
     * number) which is incremented each time the Map is updated. The DOM is then fed not by the
     * Map itself, but by a computed property (`this.accountsArray` in this case), which uses
     * both the non-reactive Map and the reactive partner-attribute. The partner-attribute change
     * triggers the recomputation, which in turn updates the DOM.
     */
    private accounts: Map<string, AccountInfo> = new Map();
    private accountsUpdateCount: number = 0;

    private result?: LoginResult;

    private contentReady: boolean = false;
    private retrievalComplete: boolean = false;

    private async mounted() {
        if (this.keyguardResult.keyType === WalletType.BIP39 || this.keyguardResult.keyType === WalletType.LEGACY) {
            this.keyguard = new KeyguardClient();
        }
        this.walletLabel = this.keyguardResult.keyType === WalletType.LEGACY
            ? 'Legacy Wallet'
            : this.keyguardResult.keyType === WalletType.BIP39
                ? 'Keyguard Wallet'
                : 'Ledger Wallet'; // TODO move these constants to a Constants class / file

        await this._setInitialAccounts();
        this.contentReady = true; // The variables are set up correctly so trigger rendering the components.

        // kick off balance update in background
        this.network = this.$refs.network as Network;
        await this.network.connect(); // await to avoid network initialization race condition with AccountFinder
        this._updateAccountBalances();

        if (this.keyguardResult.keyType === WalletType.BIP39
            || this.keyguardResult.keyType === WalletType.LEDGER) {
            // read accounts from network
            const foundAccounts = await AccountFinder.findAccounts(
                this._deriveKeyguardAccounts.bind(this),
                () => Promise.resolve(this.keyguardResult.keyId),
                LoginSuccess.DEFAULT_ACCOUNT_LABEL,
                this._addAccounts.bind(this),
            );
            this._addAccounts(foundAccounts);
        }

        if (this.keyguard) {
            this.keyguard.releaseKey(this.keyguardResult.keyId);
        }
        // TODO network visuals with longer than 1 list of accounts during retrieval
        this.retrievalComplete = true;
    }

    private async _setInitialAccounts() {
        // read potentially existing wallet and accounts from WalletStore
        const currentWalletInfo = await WalletStore.Instance.get(this.keyguardResult.keyId);
        if (currentWalletInfo) {
            this.walletLabel = currentWalletInfo.label || this.walletLabel;
            if (currentWalletInfo.accounts) {
                this.accounts = currentWalletInfo.accounts;
            }
        }

        // The Keyguard always returns (at least) one derived Address,
        // which we'll also already add and display
        const keyguardResultAccounts = this.keyguardResult.addresses.map((addressObj) => ({
            address: new Nimiq.Address(addressObj.address).toUserFriendlyAddress(),
            keyPath: addressObj.keyPath,
        }));
        this._addAccounts(keyguardResultAccounts);
    }

    private _addAccounts(accounts: Array<{ address: string, keyPath: string, balance?: number} | AccountInfo>) {
        for (const account of accounts) {
            let userFriendlyAddress;
            let keyPath;
            if (account instanceof AccountInfo) {
                userFriendlyAddress = account.address.toUserFriendlyAddress();
                keyPath = account.path;
            } else {
                userFriendlyAddress = account.address;
                keyPath = account.keyPath;
            }

            const existingAccountInfo = this.accounts.get(userFriendlyAddress);
            if (existingAccountInfo && account.balance === undefined) continue; // nothing to add or update
            const updatedAccountInfo = existingAccountInfo
                || new AccountInfo(
                    keyPath,
                    LoginSuccess.DEFAULT_ACCOUNT_LABEL,
                    Nimiq.Address.fromUserFriendlyAddress(userFriendlyAddress),
                );
            if (account.balance !== undefined) updatedAccountInfo.balance = account.balance;
            this.accounts.set(userFriendlyAddress, updatedAccountInfo);
        }
        this.accountsUpdateCount += 1; // Trigger DOM update via computed property `this.accountsArray`
        this.storeAndUpdateResult();
    }

    private async _updateAccountBalances() {
        // update balances of already known accounts for display in UI
        const userFriendlyAddresses = Array.from(this.accounts.keys());
        const balances = await this.network.getBalances(userFriendlyAddresses);
        userFriendlyAddresses.forEach((addr) => {
            const addressInfo = this.accounts.get(addr);
            addressInfo!.balance = Nimiq.Policy.coinsToSatoshis(balances.get(addr) || 0);
            this.accounts.set(addr, addressInfo!);
        });
        this.accountsUpdateCount += 1;
        this.storeAndUpdateResult();
    }

    private async _deriveKeyguardAccounts(startIndex: number, count: number) {
        const KEYGUARD_BIP39_BASE_PATH = `m/44'/242'/0'/`;
        const pathsToDerive = [];
        for (let keyId = startIndex; keyId < startIndex + count; ++keyId) {
            pathsToDerive.push(`${KEYGUARD_BIP39_BASE_PATH}${keyId}'`);
        }
        const serializedAddresses = await this.keyguard.deriveAddresses(this.keyguardResult.keyId, pathsToDerive);
        const userFriendlyAddresses = serializedAddresses.map((serializedAddress) =>
            new Nimiq.Address(serializedAddress).toUserFriendlyAddress());
        const accounts = [];
        for (let i = 0; i < pathsToDerive.length; ++i) {
            accounts.push({
                keyPath: pathsToDerive[i],
                address: userFriendlyAddresses[i],
            });
        }
        return accounts;
    }

    private onWalletLabelChange(label: string) {
        this.walletLabel = label;
        this.storeAndUpdateResult();
    }

    private onAccountLabelChanged(address: string, label: string) {
        const addressInfo = this.accounts.get(address);
        if (!addressInfo) throw new Error('UNEXPECTED: Address that was changed does not exist');
        addressInfo.label = label;
        this.accounts.set(address, addressInfo);
        this.accountsUpdateCount += 1;
        this.storeAndUpdateResult();
    }

    private storeAndUpdateResult() {
        this.walletInfo = new WalletInfo(
            this.keyguardResult.keyId,
            this.walletLabel,
            this.accounts,
            [],
            this.keyguardResult.keyType,
        );

        WalletStore.Instance.put(this.walletInfo);

        this.result = {
            walletId: this.walletInfo!.id,
            label: this.walletInfo.label,
            type: this.walletInfo.type,
            accounts: Array.from(this.accounts.values()).map((addressInfo) => ({
                address: addressInfo.userFriendlyAddress,
                label: addressInfo.label,
            })),
        };
    }

    @Emit()
    private done() {
        if (!this.result) throw new Error('Result not set');
        this.$rpc.resolve(this.result);
    }

    private get walletIconClass(): string {
        return this.keyguardResult.keyType === WalletType.LEDGER ? 'ledger' : 'keyguard';
    }

    private get accountsArray(): Array<{ label: string, address: Nimiq.Address, balance?: number }> {
        if (this.accountsUpdateCount) return Array.from(this.accounts.values());
        return [];
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
        border-bottom: solid 1px var(--nimiq-card-border-color);
    }

    .wallet-icon {
        height: 3rem;
        width: 3rem;
        flex-shrink: 0;
        margin-right: 1rem;
    }

    .network-wrapper {
        padding: 1rem;
    }

    .page-footer {
        padding: 1rem;
    }
</style>
