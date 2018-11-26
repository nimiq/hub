<template>
    <div class="container pad-bottom">
        <SmallPage>
            <div class="login-success">
                <PageHeader>Your wallet is ready</PageHeader>

                <PageBody>
                    <div class="wallet-label" v-if="keyguardResult.keyType !== 0 /* LEGACY */">
                        <div class="wallet-icon nq-icon" :class="walletIconClass"></div>
                        <LabelInput :value="walletLabel" @changed="onWalletLabelChange"/>
                    </div>

                    <AccountList :accounts="accountsArray" :editable="true" @account-changed="onAccountLabelChanged"/>

                    <div class="network-wrapper">
                        <Network :visible="keyguardResult.keyType !== 0 /* LEGACY */" :message="'Detecting your accounts'" ref="network"/>
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

@Component({components: {PageHeader, PageBody, LabelInput, AccountList, Network, PageFooter, SmallPage}})
export default class LoginSuccess extends Vue {
    @Static private request!: ParsedLoginRequest;
    @State private keyguardResult!: ImportResult;

    private keyguard!: KeyguardClient;
    private network!: Network;

    private walletInfo: WalletInfo | null = null;

    private walletLabel: string = 'Keyguard Wallet';
    private defaultAccountLabel: string = 'Standard Account';

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

    private lastDerivedIndex: number = 0;
    private lastActiveIndex: number = 0;

    private result?: LoginResult;

    private async mounted() {
        // The Keyguard always returns (at least) one derived Address,
        // thus we can already create a complete WalletInfo object that
        // can be displayed while waiting for the network.
        this.keyguardResult.addresses.forEach((addressObj) => {
            const address = new Nimiq.Address(addressObj.address);
            const addressInfo = new AccountInfo(
                addressObj.keyPath,
                this.defaultAccountLabel,
                address,
            );
            this.accounts.set(addressInfo.userFriendlyAddress, addressInfo);
            this.accountsUpdateCount += 1; // Trigger DOM update via computed property `this.accountsArray`
        });

        this.storeAndUpdateResult();

        if (this.keyguardResult.keyType === WalletType.BIP39) {
            // Init Keyguard iframe to derive accounts
            this.keyguard = new KeyguardClient();
        }

        if (this.keyguardResult.keyType === WalletType.LEDGER) {
            if (this.keyguardResult.keyType === WalletType.LEDGER) this.walletLabel = 'Ledger Wallet';
            // TODO: Init Ledger client to derive accounts
        }

        if (this.keyguardResult.keyType === WalletType.BIP39
         || this.keyguardResult.keyType === WalletType.LEDGER) {
            // Init Network to check balances
            this.network = this.$refs.network as Network;
            await this.network.connect();

            // Get balance of all accounts which were already returned from the Keyguard.
            // FIXME: Maybe this can be included in the first iteration of `this.findAccounts()`,
            //        but take care that at least one account is still added to the wallet,
            //        even when all first 20 accounts have a balance of zero.
            const userFriendlyAddresses = Array.from(this.accounts.keys());
            const balances = await this.network.getBalances(userFriendlyAddresses);
            userFriendlyAddresses.forEach((addr) => {
                const addressInfo = this.accounts.get(addr);
                addressInfo!.balance = Nimiq.Policy.coinsToSatoshis(balances.get(addr) || 0);
                this.accounts.set(addr, addressInfo!);
            });
            this.accountsUpdateCount += 1;

            // Kick off account detection
            this.findAccounts();
        }
    }

    private async findAccounts() {
        // The standard dictates that account detection terminates
        // when 20 consecutive unused accounts have been found.
        if (this.lastDerivedIndex >= this.lastActiveIndex + 20) {
            // End condition
            this.keyguard.releaseKey(this.keyguardResult.keyId);
            return;
        }

        // 1. Generate paths to derive

        // To be able to use the lastDerivedIndex as the index for the pathsToDerive array,
        // we need to fill it up until (and including) the lastDerivedIndex with `empty` values.
        const pathsToDerive: string[] = new Array(this.lastDerivedIndex + 1);

        // We can then push the paths of the relevant accounts onto the end of the array
        for (let i = this.lastDerivedIndex + 1; i <= this.lastActiveIndex + 20; i++) {
            pathsToDerive.push(`m/44'/242'/0'/${i}'`);
        }

        // 2. Derive accounts from paths

        // FIXME: Use LedgerClient here for LEDGER keys
        const serializedAddresses = await this.keyguard.deriveAddresses(
            this.keyguardResult.keyId,
            pathsToDerive.slice(this.lastDerivedIndex + 1), // We don't want to send `empty` paths into the Keyguard
        );
        const userFriendlyAddresses = serializedAddresses
            .map((rawAddr) => new Nimiq.Address(rawAddr).toUserFriendlyAddress());

        // 3. Get balances for the derived accounts

        const balances = await this.network.getBalances(userFriendlyAddresses);

        // 4. Find accounts with a non-zero balance and add them to the wallet

        balances.forEach((balance: number, userFriendlyAddress: string) => {
            this.lastDerivedIndex += 1;

            if (balance === 0) return;

            this.lastActiveIndex = this.lastDerivedIndex;

            this.accounts.set(userFriendlyAddress, new AccountInfo(
                // This is where the pre-filled pathsToDerive array from above becomes usefull.
                // It relieves us from having to calulate the correct array index with an
                // unrelated counter variable.
                pathsToDerive[this.lastDerivedIndex],
                this.defaultAccountLabel,
                Nimiq.Address.fromUserFriendlyAddress(userFriendlyAddress),
                Nimiq.Policy.coinsToSatoshis(balance),
            ));
            this.accountsUpdateCount += 1;
        });

        this.storeAndUpdateResult();

        // 5. Continue search (the end condition is checked at the beginning of the next iteration)

        this.findAccounts();
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
            return staticStore.originalRouteName;
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
