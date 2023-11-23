<template>
    <div v-if="showAccountSelector" class="container">
        <SmallPage>
            <PageHeader>
                {{ $t('Choose an Account to log in') }}
                <span slot="more">
                    {{ $t('Your account will be used for approving only.') }}
                    {{ $t('All private funds remain separate.') }}
                </span>
            </PageHeader>

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
                <button class="nq-button-s" @click="goToOnboarding">{{ $t('Login to another account') }}</button>
            </PageFooter>
        </SmallPage>

        <GlobalClose />
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { State } from 'vuex-class';
import { SmallPage, PageHeader, PageBody, PageFooter, Identicon, CaretRightSmallIcon } from '@nimiq/vue-components';
// @ts-ignore Could not find a declaration file for module '@nimiq/iqons'.
import { getBackgroundColorName } from '@nimiq/iqons';
import GlobalClose from '../components/GlobalClose.vue';
import { ParsedConnectAccountRequest } from '../lib/RequestTypes';
import { RequestType } from '../../client/PublicRequestTypes';
import staticStore, { Static } from '../lib/StaticStore';
import { WalletInfo } from '@/lib/WalletInfo';
import KeyguardClient, { KeyguardCommand } from '@nimiq/keyguard-client';
import { AccountType } from '../lib/Constants';
import LoginFileIcon from '../components/icons/LoginFileIcon.vue';
import LedgerIcon from '../components/icons/LedgerIcon.vue';

@Component({components: {
    SmallPage,
    PageHeader,
    PageBody,
    PageFooter,
    LoginFileIcon,
    LedgerIcon,
    Identicon,
    GlobalClose,
    CaretRightSmallIcon,
}})
export default class ConnectAccount extends Vue {
    @Static protected request!: ParsedConnectAccountRequest;
    @State private wallets!: WalletInfo[];

    private AccountType = AccountType;

    private showAccountSelector = false;

    private async created() {
        if (this.wallets.length === 1 && this.wallets[0].type !== WalletType.LEDGER) {
            this.setWallet(this.wallets[0], false);
        } else {
            // If more than one wallet exists or the one wallet is an unsupported LEDGER wallet, show the selector
            this.showAccountSelector = true;
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
        if (wallet.type === AccountType.LEDGER) return;

        // Map all commands that can be permissioned
        const commandMapping: Partial<Record<RequestType, KeyguardCommand>> = {
            [RequestType.SIGN_MULTISIG_TRANSACTION]: KeyguardCommand.SIGN_MULTISIG_TRANSACTION,
        };

        const permissions = this.request.permissions.map((command) => {
            const permission = commandMapping[command];
            if (!permission) throw new Error(`Permission cannot be converted to Keyguard command: ${command}`);
            return permission;
        });

        // Forward to Keyguard
        const request: KeyguardClient.ConnectRequest = {
            appName: this.request.appName,

            keyId: wallet.keyId,
            keyLabel: wallet.labelForKeyguard,

            appLogoUrl: this.request.appLogoUrl.href,
            permissions,
            requestedKeyPaths: this.request.requestedKeyPaths,
            challenge: this.request.challenge,
        };

        // To know which account was authorized in the success handler, and to store the permissions in it
        staticStore.keyguardRequest = request;

        const client = this.$rpc.createKeyguardClient(!userSelected);
        client.connectAccount(request);
    }

    private goToOnboarding() {
        // Redirect to onboarding
        staticStore.originalRouteName = RequestType.CONNECT_ACCOUNT;
        this.$router.push({name: RequestType.ONBOARD});
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
