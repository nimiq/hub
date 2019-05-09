<template>
    <div class="container">
        <SmallPage>
            <LedgerUi v-show="state === 'ledger-interaction'" @information-shown="_showLedger"></LedgerUi>
            <Loader v-if="state === 'fetching-accounts' || state === 'finished'"
                    :state="loaderState" :title="loaderTitle" :status="loaderStatus">
            </Loader>
            <IdenticonSelector v-else-if="state === 'identicon-selection'" :accounts="accountsToSelectFrom"
                               :confirmAccountSelection="false" @identicon-selected="_onAccountSelected">
            </IdenticonSelector>
            <div v-else-if="state === 'wallet-summary'" class="wallet-summary">
                <h1 class="nq-h1">Account Created</h1>
                <AccountRing :addresses="Array.from(walletInfo.accounts.keys())" animate></AccountRing>
                <div class="message nq-text">This is your account with your first address in it.</div>
                <button class="nq-button" @click="done">Finish</button>
            </div>
        </SmallPage>

        <button class="global-close nq-button-s" @click="close">
            <ArrowLeftSmallIcon/>
            Back to {{request.appName}}
        </button>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { PageBody, SmallPage, AccountRing, ArrowLeftSmallIcon } from '@nimiq/vue-components';
import { ParsedBasicRequest } from '../lib/RequestTypes';
import { Account } from '../lib/PublicRequestTypes';
import { Static } from '../lib/StaticStore';
import LedgerApi from '../lib/LedgerApi';
import LedgerUi from '../components/LedgerUi.vue';
import Loader from '../components/Loader.vue';
import IdenticonSelector from '../components/IdenticonSelector.vue';
import WalletInfoCollector from '../lib/WalletInfoCollector';
import { WalletInfo, WalletType } from '../lib/WalletInfo';
import { AccountInfo } from '../lib/AccountInfo';
import { WalletStore } from '../lib/WalletStore';
import { ERROR_CANCELED } from '../lib/Constants';
import LabelingMachine from '@/lib/LabelingMachine';

@Component({components: {PageBody, SmallPage, LedgerUi, Loader, IdenticonSelector, AccountRing, ArrowLeftSmallIcon}})
export default class SignupLedger extends Vue {
    private static readonly State = {
        IDLE: 'idle',
        LEDGER_INTERACTION: 'ledger-interaction', // can be instructions to connect or also display of an error
        FETCHING_ACCOUNTS: 'fetching-accounts',
        IDENTICON_SELECTION: 'identicon-selection',
        WALLET_SUMMARY: 'wallet-summary',
        FINISHED: 'finished',
    };

    @Static private request!: ParsedBasicRequest;

    private state: string = SignupLedger.State.IDLE;
    private walletInfo: WalletInfo | null = null;
    private accountsToSelectFrom: AccountInfo[] = [];
    private hadAccounts: boolean = false;
    private cancelled: boolean = false;
    private failedFetchingAccounts: boolean = false;

    private get loaderState() {
        return this.state === SignupLedger.State.FINISHED ? Loader.State.SUCCESS : Loader.State.LOADING;
    }

    private get loaderTitle() {
        return this.state !== SignupLedger.State.FINISHED
            ? 'Fetching Account'
            : this.hadAccounts
                ? 'You\'re logged in!'
                : 'Welcome to the Nimiq Blockchain.';
    }

    private get loaderStatus() {
        if (this.state !== SignupLedger.State.FETCHING_ACCOUNTS) return '';
        else if (this.failedFetchingAccounts) return 'Failed to fetch account. Retrying...';
        else {
            const count = !this.walletInfo ? 0 : this.walletInfo.accounts.size;
            return count > 0
                ? `Imported ${count} address${count !== 1 ? 'es' : ''} so far.`
                : '';
        }
    }

    private async created() {
        // called every time the router shows this page
        let tryCount = 0; // trying multiple times in case of errors due to weak network connection
        while (!this.cancelled) {
            try {
                tryCount += 1;
                // triggers loading and connecting states in LedgerUi if applicable
                await WalletInfoCollector.collectLedgerWalletInfo(
                    /* initialAccounts */ [],
                    (walletInfo, currentlyCheckedAccounts) =>
                        this._onWalletInfoUpdate(walletInfo, currentlyCheckedAccounts),
                    /* skipActivityCheck */ true,
                );
                this.failedFetchingAccounts = false;
                break;
            } catch (e) {
                this.failedFetchingAccounts = true;
                if (tryCount >= 5) throw e;
            }
        }

        if (this.cancelled) return;
        if (this.walletInfo!.accounts.size > 0) {
            this.hadAccounts = true;
            this.done();
        } else {
            // Let user select an account
            this.state = SignupLedger.State.IDENTICON_SELECTION;
        }
    }

    private destroyed() {
        const currentRequest = LedgerApi.currentRequest;
        if (currentRequest && currentRequest.type === LedgerApi.RequestType.DERIVE_ACCOUNTS) {
            currentRequest.cancel();
        }
        this.cancelled = true;
    }

    private async _onAccountSelected(selectedAccount: AccountInfo) {
        this.walletInfo!.accounts.set(selectedAccount.address.toUserFriendlyAddress(), selectedAccount);
        await this._onWalletInfoUpdate(this.walletInfo!);
        this.state = SignupLedger.State.WALLET_SUMMARY;
    }

    private async _onWalletInfoUpdate(
        walletInfo: WalletInfo,
        currentlyCheckedAccounts?: Array<{ address: string, path: string }>,
    ) {
        this.walletInfo = walletInfo;
        this.walletInfo.fileExported = true;
        this.walletInfo.wordsExported = true;
        if (walletInfo.accounts.size > 0) {
            await WalletStore.Instance.put(walletInfo);
        }
        if (currentlyCheckedAccounts && this.accountsToSelectFrom.length === 0) {
            // set the first set of checked accounts as the one the user can select one from, in case he doesn't have
            // an account already
            this.accountsToSelectFrom = currentlyCheckedAccounts.map((account) => new AccountInfo(
                account.path,
                LabelingMachine.labelAddress(account.address),
                Nimiq.Address.fromUserFriendlyAddress(account.address),
                0, // balance 0 because if user has to select an account, it's gonna be an unused one
            ));
        }
        this.$forceUpdate(); // because vue does not recognize changes in walletInfo.accounts map // TODO verify
    }

    private async done() {
        this.state = SignupLedger.State.FINISHED;
        setTimeout(() => {
            const result: Account = {
                accountId: this.walletInfo!.id,
                label: this.walletInfo!.label,
                type: this.walletInfo!.type,
                fileExported: this.walletInfo!.fileExported,
                wordsExported: this.walletInfo!.wordsExported,
                addresses: Array.from(this.walletInfo!.accounts.values())
                    .map((accountInfo) => accountInfo.toAddressType()),
                contracts: this.walletInfo!.contracts.map((contract) => contract.toContractType()),
            };
            this.$rpc.resolve(result);
        }, Loader.SUCCESS_REDIRECT_DELAY);
    }

    private _showLedger() {
        if (this.state === SignupLedger.State.FINISHED) return;
        const currentRequest = LedgerApi.currentRequest;
        if (!currentRequest) {
            // This should never happen. But in case it does, just show the Ledger as there might be an error shown.
            this.state = SignupLedger.State.LEDGER_INTERACTION;
            return;
        }
        if (currentRequest.type !== LedgerApi.RequestType.DERIVE_ACCOUNTS || currentRequest.cancelled) return;
        if (LedgerApi.currentState.type === LedgerApi.StateType.REQUEST_PROCESSING
            || LedgerApi.currentState.type === LedgerApi.StateType.REQUEST_CANCELLING) {
            // When we actually fetch the accounts from the device, we already want to show our own Loader instead of
            // the LedgerUi processing screen to avoid switching back and forth between LedgerUi and Loader during
            // account finding.
            this.state = SignupLedger.State.FETCHING_ACCOUNTS;
        } else {
            this.state = SignupLedger.State.LEDGER_INTERACTION;
        }
    }

    private close() {
        this.$rpc.reject(new Error(ERROR_CANCELED));
    }
}
</script>

<style scoped>
    .small-page {
        overflow: hidden;
    }

    .small-page > * {
        flex-grow: 1;
    }

    .wallet-summary {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: center;
        padding: 4rem;
    }

    .wallet-summary h1 {
        margin-top: 0;
    }

    .wallet-summary .account-ring {
        margin: 4.25rem;
        width: 20rem;
    }

    .wallet-summary .message {
        font-size: 2.5rem;
        text-align: center;
        max-width: 35rem;
    }
</style>
