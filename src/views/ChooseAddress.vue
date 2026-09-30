<template>
    <div class="container">
        <SmallPage>
            <PageHeader v-if="!request.ui || request.ui === 1">
                {{ $t('Choose an Address') }}
                <span slot="more">
                    {{ $t('{appName} is asking for an address to use.', { appName: request.appName }) }}
                </span>
            </PageHeader>
            <PageHeader v-if="request.ui === 2" :backArrow="!!preSelectedWallet" @back="preSelectedWallet = null">
                <template v-if="!preSelectedWallet">
                    {{ $t('Choose an Account') }}
                    <span slot="more">
                        {{ $t('{appName} is asking for an account to use.', { appName: request.appName }) }}
                    </span>
                </template>
                <template v-else>
                    {{ $t('Choose an Address') }}
                    <span slot="more">
                        {{ $t('Choose which Nimiq address to use.') }}
                    </span>
                </template>
            </PageHeader>

            <AccountSelector
                v-if="preSelectedWallet || !request.ui || request.ui === 1"
                :wallets="preSelectedWallet ? [preSelectedWallet] : processedWallets"
                :minBalance="request.minBalance"
                :disableContracts="request.disableContracts"
                :disableLegacyAccounts="request.disableLegacyAccounts"
                :disableBip39Accounts="request.disableBip39Accounts"
                :disableLedgerAccounts="request.disableLedgerAccounts"
                :highlightBitcoinAccounts="preSelectedWallet ? false : request.returnBtcAddress"
                :highlightUsdcAccounts="preSelectedWallet ? false : request.returnUsdcAddress"
                @account-selected="accountSelected"
                @login="() => goToOnboarding(false)"/>

            <PageFooter v-if="addressCreationWallet">
                <button class="nq-button-s" @click="addAddress">
                    {{ $t('Use a new address') }}
                </button>
            </PageFooter>

            <template v-if="!preSelectedWallet && request.ui === 2">
                <PageBody>
                    <div class="account-selector">
                        <button v-for="wallet of wallets" :key="wallet.id"
                            class="account-item"
                            @click="() => setWallet(wallet)"
                            :disabled="wallet.type === AccountType.LEDGER"
                        >
                            <div v-if="wallet.type === AccountType.BIP39" class="icon"
                                :class="backgroundClass(wallet.accounts.values().next().value.address.toUserFriendlyAddress())"
                            ><LoginFileIcon /></div>
                            <Identicon v-else-if="wallet.type === AccountType.LEGACY" class="icon"
                                :address="wallet.accounts.values().next().value.address.toUserFriendlyAddress()"/>
                            <div v-else-if="wallet.type === AccountType.LEDGER" class="icon">
                                <LedgerIcon />
                            </div>

                            <span class="label">
                                {{ wallet.type === AccountType.LEGACY
                                    ? wallet.accounts.values().next().value.label
                                    : wallet.label }}
                            </span>
                            <CaretRightSmallIcon />
                        </button>
                    </div>
                </PageBody>

                <PageFooter>
                    <button class="nq-button-s" @click="() => goToOnboarding(false)">
                        {{ $t('Login to another account') }}
                    </button>
                </PageFooter>
            </template>

            <StatusScreen v-if="state !== State.NONE"
                :state="statusScreenState"
                :title="statusScreenTitle"
                :status="statusScreenStatus"
                :message="statusScreenMessage"
                :mainAction="statusScreenAction"
                :lightBlue="!useDarkSyncStatusScreen"
                @main-action="_statusScreenActionHandler"
            />
        </SmallPage>

        <GlobalClose />
    </div>
</template>

<script lang="ts">
import { Component } from 'vue-property-decorator';
import { Getter, Mutation, State } from 'vuex-class';
import { SmallPage, AccountSelector } from '@nimiq/vue-components';
import { PageHeader, PageBody, PageFooter, Identicon, CaretRightSmallIcon } from '@nimiq/vue-components';
// @ts-ignore Could not find a declaration file for module '@nimiq/iqons'.
import { getBackgroundColorName } from '@nimiq/iqons';
import Config from 'config';
import BitcoinSyncBaseView from './BitcoinSyncBaseView.vue';
import StatusScreen from '../components/StatusScreen.vue';
import GlobalClose from '../components/GlobalClose.vue';
import { Address, ChooseAddressResult, RequestType, RpcResult } from '../../client/PublicRequestTypes';
import { ParsedChooseAddressRequest } from '../lib/RequestTypes';
import staticStore, { Static } from '../lib/StaticStore';
import { WalletStore } from '../lib/WalletStore';
import { WalletInfo } from '../lib/WalletInfo';
import { AccountInfo } from '../lib/AccountInfo';
import { ContractInfo } from '../lib/ContractInfo';
import { BtcAddressInfo } from '../lib/bitcoin/BtcAddressInfo';
import { EXTERNAL_INDEX } from '../lib/bitcoin/BitcoinConstants';
import { AccountType } from '../lib/Constants';
import LoginFileIcon from '../components/icons/LoginFileIcon.vue';
import LedgerIcon from '../components/icons/LedgerIcon.vue';

@Component({components: {
    AccountSelector,
    SmallPage,
    StatusScreen,
    GlobalClose,
    PageHeader,
    PageBody,
    PageFooter,
    Identicon,
    CaretRightSmallIcon,
    LoginFileIcon,
    LedgerIcon,
}})
export default class ChooseAddress extends BitcoinSyncBaseView {
    @Static private request!: ParsedChooseAddressRequest;
    @Static private sideResult?: RpcResult | Error;

    @Getter private findWallet!: (id: string) => WalletInfo | undefined;
    @Getter private processedWallets!: WalletInfo[];

    @State private wallets!: WalletInfo[];
    @State private activeWalletId!: string | null;

    private AccountType = AccountType;
    private preSelectedWallet: WalletInfo | null = null;

    @Mutation('setActiveAccount') private $setActiveAccount!: (payload: {
        walletId: string,
        userFriendlyAddress: string,
    }) => any;

    @Mutation('addWallet') private $addWallet!: (walletInfo: WalletInfo) => any;

    public async created() {
        // Coming back from the add-address flow started below. The new address is already
        // stored, but our copy of the wallet in the Vuex store predates it, so re-read it
        // before resolving with an address that would otherwise look unknown.
        if (this.sideResult && !(this.sideResult instanceof Error) && 'address' in this.sideResult) {
            const { address } = this.sideResult as Address;
            delete staticStore.sideResult;

            const wallet = this.activeWalletId
                ? await WalletStore.Instance.get(this.activeWalletId)
                : undefined;
            if (wallet && wallet.accounts.has(address)) {
                this.$addWallet(wallet);
                this.accountSelected(wallet.id, address);
                return;
            }
            // The address did not arrive where it was expected. Fall through to the picker
            // rather than resolving with something we cannot describe.
        }

        if (this.processedWallets.length === 0) {
            this.goToOnboarding(true);
        }
    }

    /**
     * The account a new address would be added to, or null when that is not a single
     * answer. Only offered for BIP39 accounts: a legacy account holds exactly one address
     * and a Ledger needs its own flow, which `AddAccount` already refuses and routes.
     */
    private get addressCreationWallet(): WalletInfo | null {
        if (this.preSelectedWallet) {
            return this.preSelectedWallet.type === AccountType.BIP39 ? this.preSelectedWallet : null;
        }
        if (this.request.ui === 2) return null; // still choosing an account, not an address
        const candidates = this.processedWallets.filter((wallet) => wallet.type === AccountType.BIP39);
        return candidates.length === 1 ? candidates[0] : null;
    }

    private addAddress() {
        const wallet = this.addressCreationWallet;
        if (!wallet) return;

        // `AddAccount` reads the wallet to derive from off the active account, because the
        // request it inherits here is a ChooseAddress request and carries no walletId.
        this.$setActiveAccount({
            walletId: wallet.id,
            userFriendlyAddress: wallet.accounts.keys().next().value,
        });

        staticStore.originalRouteName = RequestType.CHOOSE_ADDRESS;
        this.$router.push({name: RequestType.ADD_ADDRESS});
    }

    private async accountSelected(walletId: string, address: string) {
        const walletInfo = this.findWallet(walletId);
        if (!walletInfo) {
            console.error('UNEXPECTED: Selected walletId not found:', walletId);
            return;
        }

        const accountOrContractInfo: AccountInfo | ContractInfo = walletInfo.accounts.get(address) ||
            walletInfo.findContractByAddress(Nimiq.Address.fromString(address))!;

        this.$setActiveAccount({
            walletId: walletInfo.id,
            userFriendlyAddress: accountOrContractInfo.userFriendlyAddress,
        });

        let btcAddress: string | undefined;
        let usdcAddress: string | undefined;

        if (Config.enableBitcoin && this.request.returnBtcAddress && walletInfo.btcXPub) {
            this.state = this.State.SYNCING;
            let externalAddresses: BtcAddressInfo[];
            try {
                // Detect and persist this wallet's external addresses
                externalAddresses = (await walletInfo.syncBitcoinAddresses(
                    [EXTERNAL_INDEX],
                    { resyncKnownUnusedAddresses: true, maxUnusedAddresses: 2 },
                )).external;
            } catch (error) {
                this.state = this.State.SYNCING_FAILED;
                this.error = error.message;
                return;
            }
            const unusedExternalAddresses = externalAddresses.filter((addressInfo) => !addressInfo.used);
            if (unusedExternalAddresses.length > 0) {
                // We try to use the 2nd unused address, because the first is reserved for swaps and not displayed
                // in the wallet (cannot be validated by the user).
                btcAddress = unusedExternalAddresses[Math.min(unusedExternalAddresses.length - 1, 1)].address;
            }
        }

        if (this.request.returnUsdcAddress && walletInfo.polygonAddresses.length) {
            usdcAddress = walletInfo.polygonAddresses[0].address;
        }

        const result: ChooseAddressResult = {
            address: accountOrContractInfo.userFriendlyAddress,
            label: accountOrContractInfo.label,
            btcAddress,
            usdcAddress,
            meta: {
                account: {
                    label: walletInfo.label,
                    color: getBackgroundColorName(walletInfo.accounts.keys().next().value).toLowerCase(),
                },
            },
        };

        this.$rpc.resolve(result);
    }

    private goToOnboarding(useReplace?: boolean) {
        // Redirect to onboarding
        staticStore.originalRouteName = RequestType.CHOOSE_ADDRESS;
        if (useReplace) {
            this.$router.replace({name: RequestType.ONBOARD});
        } else {
            this.$router.push({name: RequestType.ONBOARD});
        }
    }

    private backgroundClass(address: string) {
        let color = getBackgroundColorName(address).toLowerCase() as string;

        // Convert from public to CSS names
        if (color === 'yellow') color = 'gold';
        else if (color === 'indigo') color = 'blue';
        else if (color === 'blue') color = 'light-blue';
        else if (color === 'teal') color = 'green';
        else if (color === 'green') color = 'light-green';

        return `nq-${color}-bg`;
    }

    private async setWallet(wallet: WalletInfo, userSelected = true) {
        if (wallet.accounts.size === 1) {
            this.accountSelected(wallet.id, wallet.accounts.keys().next().value);
        } else {
            this.preSelectedWallet = wallet;
        }
    }
}
</script>

<style scoped>
.page-header {
    padding-bottom: 2rem;
}

.page-header >>> span {
    display: block;
    font-size: 2rem;
    line-height: 1.375;
    opacity: 0.6;
    margin: 1rem 2rem 0;
}

.small-page {
    position: relative;
}

.request-info {
    text-align: center;
    margin-left: 2rem;
    margin-right: 2rem;
    flex-shrink: 0;
}

.status-screen {
    position: absolute;
    left: 0;
    top: 0;
    right: 0;
    bottom: 0;
}

.page-body {
    padding: 0 2rem;
}

.account-item {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 2rem;
    margin: 0.5rem 0;
    border-radius: 0.75rem;
    border: none;
    background: transparent;
    transition: background 250ms var(--nimiq-ease);
    font-size: 2rem;
    font-weight: 600;
    color: inherit;
    font-family: inherit;
    text-align: left;
}

.account-item:not(:disabled):hover,
.account-item:not(:disabled):focus {
    background: var(--nimiq-highlight-bg);
    cursor: pointer;
}

.account-item .nq-icon {
    height: 3rem;
    width: 3rem;
    margin-right: 1rem;
    opacity: 0.25;
    transition: opacity 250ms var(--nimiq-ease);
}

.account-item .nq-icon >>> path {
    stroke-width: 1;
}

.account-item:not(:disabled):hover .nq-icon,
.account-item:not(:disabled):focus .nq-icon {
    opacity: 0.5;
}

.account-item:disabled {
    opacity: 0.4;
}

.account-item .icon {
    margin-right: 2rem;
    width: 3rem;
    height: 5rem;
    border-radius: 0.375rem;
}

.account-item .icon.identicon {
    width: 5rem;
    margin-left: -1rem;
    margin-right: 1rem;
}

.account-item .label {
    flex-grow: 1;
}

.page-footer {
    align-items: center;
    padding-top: 1rem;
    padding-bottom: 3rem;
}
</style>
