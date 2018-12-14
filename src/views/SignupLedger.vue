<template>
    <div class="container">
        <SmallPage>
            <LedgerUi v-show="state === 'ledger-interaction'" @information-shown="_showLedger"></LedgerUi>
            <IdenticonSelector :accounts="accountsToSelectFrom" v-if="state === 'identicon-selection'"
                                @identicon-selected="_onAccountSelected">
            </IdenticonSelector>
            <Loader v-else-if="state === 'fetching-accounts' || state === 'finished'"
                    :state="loaderState" :title="loaderTitle" :status="loaderStatus">
            </Loader>
        </SmallPage>

        <button class="global-close nq-button-s" @click="close">
            <span class="nq-icon arrow-left"></span>
            Back to {{request.appName}}
        </button>
    </div>
</template>

<script lang="ts">
import { Component, Emit, Vue } from 'vue-property-decorator';
import { PageBody, SmallPage } from '@nimiq/vue-components';
import { ParsedSignupRequest, SignupResult } from '../lib/RequestTypes';
import { ResponseStatus, State as RpcState } from '@nimiq/rpc';
import { Static } from '../lib/StaticStore';
import LedgerApi from '../lib/LedgerApi';
import LedgerUi from '../components/LedgerUi.vue';
import IdenticonSelector from '../components/IdenticonSelector.vue';
import Loader from '../components/Loader.vue';
import WalletInfoCollector from '../lib/WalletInfoCollector';
import { WalletInfo, WalletType } from '../lib/WalletInfo';
import { AccountInfo } from '../lib/AccountInfo';
import { WalletStore } from '../lib/WalletStore';
import { ACCOUNT_DEFAULT_LABEL_LEDGER } from '../lib/Constants';

@Component({components: {PageBody, SmallPage, LedgerUi, IdenticonSelector, Loader}})
export default class SignupLedger extends Vue {
    private static readonly State = {
        IDLE: 'idle',
        LEDGER_INTERACTION: 'ledger-interaction', // can be instructions to connect or also display of an error
        FETCHING_ACCOUNTS: 'fetching-accounts',
        IDENTICON_SELECTION: 'identicon-selection',
        FINISHED: 'finished',
    };

    @Static private rpcState!: RpcState;
    @Static private request!: ParsedSignupRequest;

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
            ? 'Fetching Accounts'
            : this.hadAccounts
                ? 'You\'re logged in!'
                : 'Welcome to the Nimiq Blockchain.';
    }

    private get loaderStatus() {
        if (this.state !== SignupLedger.State.FETCHING_ACCOUNTS) return '';
        else if (this.failedFetchingAccounts) return 'Failed to fetch accounts. Retrying...';
        else {
            const count = !this.walletInfo ? 0 : this.walletInfo.accounts.size;
            return count > 0
                ? `Imported ${count} account${count > 1 ? 's' : ''} so far.`
                : '';
        }
    }

    private created() {
        // called everytime the router shows this page
        this._run();
    }

    private destroyed() {
        const currentRequest = LedgerApi.currentRequest;
        if (currentRequest && currentRequest.type === LedgerApi.RequestType.DERIVE_ACCOUNTS) {
            currentRequest.cancel();
        }
        this.cancelled = true;
    }

    private async _run() {
        if (this.state !== SignupLedger.State.IDLE) return;

        let tryCount = 0;
        while (!this.cancelled) {
            try {
                tryCount += 1;
                // triggers loading and connecting states in LedgerUi if applicable
                await WalletInfoCollector.collectWalletInfo(
                    WalletType.LEDGER,
                    /* walletId */ undefined,
                    /* initialAccounts */ [],
                    (walletInfo, currentlyCheckedAccounts) =>
                        this._onWalletInfoUpdate(walletInfo, currentlyCheckedAccounts),
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

    private async _onAccountSelected(selectedAccount: AccountInfo) {
        this.walletInfo!.accounts.set(selectedAccount.address.toUserFriendlyAddress(), selectedAccount);
        await this._onWalletInfoUpdate(this.walletInfo!);
        this.done();
    }

    private async _onWalletInfoUpdate(
        walletInfo: WalletInfo,
        currentlyCheckedAccounts?: Array<{ address: string, path: string }>,
    ) {
        this.walletInfo = walletInfo;
        await WalletStore.Instance.put(walletInfo);
        if (currentlyCheckedAccounts && this.accountsToSelectFrom.length === 0) {
            // set the first set of checked accounts as the one the user can select one from, in case he doesn't have
            // an account already
            this.accountsToSelectFrom = currentlyCheckedAccounts.map((account) => new AccountInfo(
                account.path,
                ACCOUNT_DEFAULT_LABEL_LEDGER,
                Nimiq.Address.fromUserFriendlyAddress(account.address),
                0, // balance 0 because if user has to select an account, it's gonna be an unused one
            ));
        }
        this.$forceUpdate(); // because vue does not recognize changes in waletInfo.accounts map // TODO verify
    }

    @Emit()
    private async done() {
        this.state = SignupLedger.State.FINISHED;
        setTimeout(() => {
            const result: SignupResult = {
                walletId: this.walletInfo!.id,
                label: this.walletInfo!.label,
                type: this.walletInfo!.type,
                accounts: Array.from(this.walletInfo!.accounts.values()).map((accountInfo) => ({
                    address: accountInfo.userFriendlyAddress,
                    label: accountInfo.label,
                })),
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
            // When we actually fetch the accounts from the device, we already wanna show our own Loader instead of the
            // LedgerUi processing screen to avoid switching back and forth between LedgerUi and Loader during account
            // finding.
            this.state = SignupLedger.State.FETCHING_ACCOUNTS;
        } else {
            this.state = SignupLedger.State.LEDGER_INTERACTION;
        }
    }

    @Emit()
    private close() {
        this.rpcState.reply(ResponseStatus.ERROR, new Error('CANCEL'));
    }
}
</script>

<style scoped>
    .small-page {
        overflow: hidden;
    }

    .page-body {
        padding: 0;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
    }

    .ledger-ui {
        flex-grow: 1;
    }

    .loader {
        flex-grow: 1;
    }
</style>
