<template>
    <div class="container">
        <SmallPage>
            <LedgerUi v-show="state === 'ledger-interaction'" @information-shown="_showLedger"></LedgerUi>
            <IdenticonSelector :accounts="accounts" v-if="state === 'identicon-selection'"
                                @identicon-selected="_onAccountsImported">
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
import { ParsedSignupRequest } from '../lib/RequestTypes';
import { ResponseStatus, State as RpcState } from '@nimiq/rpc';
import { Static } from '../lib/StaticStore';
import LedgerApi from '../lib/LedgerApi';
import LedgerUi from '../components/LedgerUi.vue';
import IdenticonSelector from '../components/IdenticonSelector.vue';
import Loader from '../components/Loader.vue';
import { AccountInfo } from '../lib/AccountInfo';

@Component({components: {PageBody, SmallPage, LedgerUi, IdenticonSelector, Loader}})
export default class SignupLedger extends Vue {
    private static readonly DEFAULT_ACCOUNT_LABEL = 'Ledger Account';
    private static readonly COUNT_ACCOUNTS_TO_DERIVE = 20;
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
    private accounts: AccountInfo[] = [];
    private cancelled: boolean = false;
    private hadAccounts: boolean = false;
    private failedFetchingAccounts: boolean = false;

    private wasmPromise!: Promise<void>;

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
        return this.state === SignupLedger.State.FETCHING_ACCOUNTS && this.failedFetchingAccounts
            ? 'Failed to fetch accounts. Retrying...'
            : '';
    }

    private created() {
        // called everytime the router shows this page
        this.close = this.close.bind(this);
        LedgerApi.on(LedgerApi.EventType.REQUEST_CANCELLED, this.close);
        this._run();
        this.wasmPromise = Nimiq.WasmHelper.doImportBrowser(); // kick off wasm import to be ready in _calculateWalletId
    }

    private destroyed() {
        LedgerApi.off(LedgerApi.EventType.REQUEST_CANCELLED, this.close);
        const currentRequest = LedgerApi.currentRequest;
        if (currentRequest && currentRequest.type === LedgerApi.RequestType.DERIVE_ACCOUNTS) {
            currentRequest.cancel();
        }
        this.cancelled = true;
    }

    private async _run() {
        if (this.state !== SignupLedger.State.IDLE) return;
        // triggers loading and connecting states in LedgerUi if applicable
        const pathsToDerive = [];
        for (let keyId = 0; keyId < SignupLedger.COUNT_ACCOUNTS_TO_DERIVE; ++keyId) {
            pathsToDerive.push(LedgerApi.getBip32PathForKeyId(keyId));
        }
        this.accounts = (await LedgerApi.deriveAccounts(pathsToDerive)).map((account) =>
            new AccountInfo(account.keyPath, SignupLedger.DEFAULT_ACCOUNT_LABEL,
                Nimiq.Address.fromUserFriendlyAddress(account.address)));

        if (this.cancelled) return;
        // TODO actually fetch accounts
        this.state = SignupLedger.State.FETCHING_ACCOUNTS;
        await new Promise((resolve) => setTimeout(resolve, 3000));

        if (this.cancelled) return;
        this.hadAccounts = false;

        // Let user select an account
        this.state = SignupLedger.State.IDENTICON_SELECTION;
    }

    private _showLedger() {
        const currentRequest = LedgerApi.currentRequest;
        if (!currentRequest) {
            // This should never happen. But in case it does, just show the Ledger as there might be an error shown.
            this.state = SignupLedger.State.LEDGER_INTERACTION;
            return;
        }
        if (currentRequest.type !== LedgerApi.RequestType.DERIVE_ACCOUNTS || currentRequest.cancelled) return;
        if (LedgerApi.currentState.type === LedgerApi.StateType.REQUEST_PROCESSING) {
            // When we actually fetch the accounts from the device, we already wanna show our own Loader instead of the
            // LedgerUi processing screen to avoid switching back and forth between LedgerUi and Loader during account
            // finding.
            this.state = SignupLedger.State.FETCHING_ACCOUNTS;
        } else {
            this.state = SignupLedger.State.LEDGER_INTERACTION;
        }
    }

    private async _onAccountsImported(importedAccounts: AccountInfo | AccountInfo[]) {
        if (!Array.isArray(importedAccounts)) {
            importedAccounts = [importedAccounts];
        }
        // TODO store accounts
        this.state = SignupLedger.State.FINISHED;
    }

    private async _calculateWalletId(): Promise<string> {
        if (this.accounts.length === 0) throw new Error('No ledger accounts retrieved yet.');
        // calculate wallet id deterministically from first account similarly to legacy wallets in Key.js in Keyguard
        await this.wasmPromise; // load wasm to be able to compute hash
        const input = this.accounts[0].address.serialize();
        return Nimiq.BufferUtils.toHex(Nimiq.Hash.blake2b(input).subarray(0, 6));
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
