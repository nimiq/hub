<template>
    <div class="login-success">
        <PageHeader>Your wallet is ready</PageHeader>

        <div class="page-body">
            <div class="login-label" v-if="keyguardResult.keyType !== 0 /* LEGACY */">
                <div class="login-icon" :class="walletIconClass"></div>
                <LabelInput :value="walletLabel" @changed="onWalletLabelChange"/>
            </div>

            <AccountList :accounts="accounts" :editable="true" @account-changed="onAccountLabelChanged"/>
        </div>

        <PageFooter>
            <Network :visible="keyguardResult.keyType !== 0 /* LEGACY */" :message="'Detecting your accounts'" ref="network"/>
            <button @click="done">Back to {{ request.appName }}</button>
        </PageFooter>
    </div>
</template>

<script lang="ts">
import { Component, Emit, Vue } from 'vue-property-decorator';
import { ParsedLoginRequest, LoginResult } from '../lib/RequestTypes';
import { State } from 'vuex-class';
import { KeyInfo, KeyStorageType } from '../lib/KeyInfo';
import { ImportResult, KeyguardClient } from '@nimiq/keyguard-client';
import { ResponseStatus, State as RpcState } from '@nimiq/rpc';
import { AddressInfo } from '@/lib/AddressInfo';
import { KeyStore } from '@/lib/KeyStore';
import { Static } from '@/lib/StaticStore';
import { PageHeader, LabelInput, AccountList, PageFooter } from '@nimiq/vue-components';
import Network from '@/components/Network.vue';

@Component({components: {PageHeader, LabelInput, AccountList, Network, PageFooter}})
export default class LoginSuccess extends Vue {
    @Static private request!: ParsedLoginRequest;
    @Static private rpcState!: RpcState;
    @State private keyguardResult!: ImportResult;

    private keyguard!: KeyguardClient;
    private network!: Network;

    private keyInfo: KeyInfo | null = null;

    private walletLabel: string = 'Keyguard Wallet';
    private defaultAccountLabel: string = 'Standard Account';

    private addresses: Map<string, AddressInfo> = new Map();
    private addressesUpdateCount: number = 0;

    private lastDerivedIndex: number = 0;
    private lastActiveIndex: number = 0;

    private result?: LoginResult;

    private async mounted() {
        this.keyguardResult.addresses.forEach((addressObj) => {
            const address = new Nimiq.Address(addressObj.address);
            const addressInfo = new AddressInfo(
                addressObj.keyPath,
                this.defaultAccountLabel,
                address,
            );
            this.addresses.set(addressInfo.userFriendlyAddress, addressInfo);
            this.addressesUpdateCount += 1;
        });

        this.storeAndUpdateResult();

        if (this.keyguardResult.keyType === KeyStorageType.BIP39) {
            // Init Keyguard iframe to derive addresses
            this.keyguard = new KeyguardClient();
        }

        if (this.keyguardResult.keyType === KeyStorageType.LEDGER) {
            if (this.keyguardResult.keyType === KeyStorageType.LEDGER) this.walletLabel = 'Ledger Wallet';
            // TODO: Init Ledger client to derive addresses
        }

        if (this.keyguardResult.keyType === KeyStorageType.BIP39
         || this.keyguardResult.keyType === KeyStorageType.LEDGER) {
            // Init Network to check balances
            this.network = this.$refs.network as Network;
            await this.network.connect();

            // Get balance of first account (which was already returned from the Keyguard)
            const addressInfo = this.addresses.values().next().value;
            const userFriendlyAddress = addressInfo.userFriendlyAddress;
            const balance = await this.network.getBalances([userFriendlyAddress]);
            addressInfo.balance = Nimiq.Policy.coinsToSatoshis(balance.get(userFriendlyAddress) || 0);
            this.addresses.set(userFriendlyAddress, addressInfo);
            this.addressesUpdateCount += 1;

            // Kick off account detection
            this.findAccounts();
        }
    }

    private async findAccounts() {
        // The standard dictates that account detection terminates
        // when 20 consecutive unused addresses have been found.
        if (this.lastDerivedIndex >= this.lastActiveIndex + 20) {
            // this.finished();
            return;
        }

        const pathsToDerive: string[] = new Array(this.lastDerivedIndex + 1);

        for (let i = this.lastDerivedIndex + 1; i <= this.lastActiveIndex + 20; i++) {
            pathsToDerive.push(`m/44'/242'/0'/${i}'`);
        }

        // FIXME: Use LedgerClient here for LEDGER keys
        const rawAddresses = await this.keyguard.deriveAddresses(
            this.keyguardResult.keyId,
            pathsToDerive.slice(this.lastDerivedIndex + 1),
        );
        const userFriendlyAddresses = rawAddresses.map((rawAddr) => new Nimiq.Address(rawAddr).toUserFriendlyAddress());

        const balances = await this.network.getBalances(userFriendlyAddresses);

        balances.forEach((balance: number, userFriendlyAddress: string) => {
            this.lastDerivedIndex += 1;

            if (balance === 0) return;

            this.lastActiveIndex = this.lastDerivedIndex;

            this.addresses.set(userFriendlyAddress, new AddressInfo(
                pathsToDerive[this.lastDerivedIndex],
                this.defaultAccountLabel,
                Nimiq.Address.fromUserFriendlyAddress(userFriendlyAddress),
                Nimiq.Policy.coinsToSatoshis(balance),
            ));
            this.addressesUpdateCount += 1;
        });

        this.storeAndUpdateResult();
        this.findAccounts();
    }

    private onWalletLabelChange(label: string) {
        this.walletLabel = label;
        this.storeAndUpdateResult();
    }

    private onAccountLabelChanged(address: Nimiq.Address, label: string) {
        const addressInfo = this.addresses.get(address.toUserFriendlyAddress());
        if (!addressInfo) throw new Error('UNEXPECTED: Address that was changed does not exist');
        addressInfo.label = label;
        this.addresses.set(address.toUserFriendlyAddress(), addressInfo);
        this.addressesUpdateCount += 1;
        this.storeAndUpdateResult();
    }

    private storeAndUpdateResult() {
        this.keyInfo = new KeyInfo(
            this.keyguardResult.keyId,
            this.walletLabel,
            this.addresses,
            [],
            this.keyguardResult.keyType,
        );

        KeyStore.Instance.put(this.keyInfo);

        this.result = {
            addresses: Array.from(this.addresses.values()).map((addressInfo) => ({
                address: addressInfo.userFriendlyAddress,
                label: addressInfo.label,
                keyId: this.keyInfo!.id,
            })),
        };
    }

    @Emit()
    private done() {
        if (!this.result) throw new Error('Result not set');
        this.rpcState.reply(ResponseStatus.OK, this.result);
    }

    private get walletIconClass(): string {
        return this.keyguardResult.keyType === KeyStorageType.LEDGER ? 'ledger' : 'keyguard';
    }

    private get accounts(): Array<{ label: string, address: Nimiq.Address, balance?: number }> {
        if (this.addressesUpdateCount) return Array.from(this.addresses.values());
        return [];
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
        background: #fafafa;
        flex-grow: 1;
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
        background-repeat: no-repeat;
        background-position: center;
    }

    .login-icon.keyguard {
        background-image: url('data:image/svg+xml,<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 24 28" style="enable-background:new 0 0 24 28;" xml:space="preserve"><path fill="%23F5AF2D" d="M15.45,9.57c-0.15-0.3-0.57-0.53-0.89-0.53H9.42c-0.32,0-0.72,0.23-0.89,0.53l-2.57,4.49 c-0.15,0.28-0.15,0.76,0,1.03l2.57,4.49c0.17,0.3,0.57,0.53,0.89,0.53h5.14c0.35,0,0.74-0.23,0.89-0.53l2.57-4.49 c0.17-0.28,0.17-0.76,0-1.03L15.45,9.57z M23.58,5.29C23.83,5.36,24,5.59,24,5.85c0,10-0.87,17.98-11.8,22.11 C12.13,27.99,12.07,28,12,28c-0.07,0-0.13-0.01-0.2-0.04C0.87,23.83,0,15.85,0,5.85c0-0.26,0.17-0.49,0.42-0.56 c0.08-0.02,8.46-2.35,11.16-5.12c0.21-0.22,0.61-0.22,0.83,0C15.12,2.94,23.49,5.27,23.58,5.29z"/></svg>');
        background-size: auto 3rem;
    }

    .login-icon.ledger {
        background-image: url('data:image/svg+xml,<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 25 25" style="enable-background:new 0 0 25 25;" xml:space="preserve"><path fill="%23333745" d="M21.05,0H9.5V15.1H25l0-11.17C25,1.81,23.22,0,21.05,0"/><path fill="%23333745" d="M6.04,0H4.08C1.88,0,0,1.75,0,3.98v1.91h6.04V0z"/><rect fill="%23333745" y="9.21" width="6.08" height="5.92"/><path fill="%23333745" d="M18.92,25h1.97C23.11,25,25,23.24,25,21v-1.92h-6.08V25z"/><rect fill="%23333745" x="9.46" y="19.08" width="6.08" height="5.92"/><path fill="%23333745" d="M0,19.08V21c0,2.16,1.8,4,4.11,4h1.97v-5.92H0z"/></svg>');
        background-size: 2.5rem;
    }

    button {
        background: #724ceb;
        color: white;
        margin: 3rem 0;
    }

    .page-footer {
        height: auto;
        padding: 1rem;
        flex-direction: column;
    }
</style>
