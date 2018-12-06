<template>
    <div class="container">
        <SmallPage>
            <PageHeader :progressIndicator="true" :numberSteps="3" :step="2">{{ title }}</PageHeader>
            <PageBody>
                <LedgerUi v-show="state === 'ledger-call'" @information-shown="_showLedger"></LedgerUi>
                <div v-if="state === 'accounts-check'">
                    <div class="loading-animation"></div>
                    <div>{{ accountsCheckMessage }}</div>
                </div>
                <IdenticonSelector :accounts="accounts"
                                    v-else-if="state === 'identicon-selection'"
                                    @identicon-selected="_onAccountsImported">
                </IdenticonSelector>
            </PageBody>
        </SmallPage>

        <button class="global-close nq-button-s" @click="close">
            <span class="nq-icon arrow-left"></span>
            Back to {{request.appName}}
        </button>
    </div>
</template>

<script lang="ts">
import { Component, Emit, Vue } from 'vue-property-decorator';
import { PageBody, PageHeader, SmallPage } from '@nimiq/vue-components';
import { ParsedSignupRequest, RequestType } from '../lib/RequestTypes';
import { ResponseStatus, State as RpcState } from '@nimiq/rpc';
import { Static } from '../lib/StaticStore';
import LedgerApi from '../lib/LedgerApi';
import LedgerUi from '../components/LedgerUi.vue';
import IdenticonSelector from '../components/IdenticonSelector.vue';
import { AccountInfo } from '../lib/AccountInfo';
import { RouterQueryEncoder } from '../router';

@Component({components: {PageHeader, PageBody, SmallPage, LedgerUi, IdenticonSelector}})
export default class SignupLedger extends Vue {
    private static readonly COUNT_ACCOUNTS_TO_DERIVE = 20;
    private static readonly State = {
        IDLE: 'idle',
        LEDGER_CALL: 'ledger-call',
        ACCOUNTS_CHECK: 'accounts-check',
        IDENTICON_SELECTION: 'identicon-selection',
    };

    @Static private rpcState!: RpcState;
    @Static private request!: ParsedSignupRequest;

    private state: string = SignupLedger.State.IDLE;
    private accounts: AccountInfo[] = [];
    private cancelled: boolean = false;
    private hadAccounts: boolean = false;
    private failedFetchingAccounts: boolean = false;

    private wasmPromise!: Promise<void>;

    private get title() {
        switch (this.state) {
            case SignupLedger.State.IDENTICON_SELECTION:
                return 'Choose an Account';
            default:
                return 'Connect Ledger';
        }
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

    private get accountsCheckMessage(): string {
        return !this.failedFetchingAccounts ? 'Fetching Accounts...' : 'Failed fetching accounts. Retrying...';
    }

    private async _run() {
        if (this.state !== SignupLedger.State.IDLE) return;
        // triggers loading and connecting states in LedgerUi if applicable
        const accountsToDerive = [];
        for (let keyId = 0; keyId < SignupLedger.COUNT_ACCOUNTS_TO_DERIVE; ++keyId) {
            accountsToDerive.push(LedgerApi.getBip32PathForKeyId(keyId));
        }
        this.accounts = (await LedgerApi.deriveAccounts(accountsToDerive)).map((account) =>
            new AccountInfo(account.keyPath, 'Ledger Account', Nimiq.Address.fromUserFriendlyAddress(account.address)));

        if (this.cancelled) return;
        // TODO actually fetch accounts
        this.state = SignupLedger.State.ACCOUNTS_CHECK;
        await new Promise((resolve) => setTimeout(resolve, 3000));

        if (this.cancelled) return;
        this.hadAccounts = false;

        // Let user select an account
        this.state = SignupLedger.State.IDENTICON_SELECTION;
    }

    private _showLedger() {
        const currentRequest = LedgerApi.currentRequest;
        if (currentRequest
            && (currentRequest.type !== LedgerApi.RequestType.DERIVE_ACCOUNTS || currentRequest.cancelled)) return;
        this.state = SignupLedger.State.LEDGER_CALL;
    }

    private async _onAccountsImported(importedAccounts: AccountInfo | AccountInfo[]) {
        if (!Array.isArray(importedAccounts)) {
            importedAccounts = [importedAccounts];
        }
        if (!this.hadAccounts) {
            this.$router.push({
                name: `${RequestType.SIGNUP}-success`,
                query: {
                    createResult: RouterQueryEncoder.encodeCreateResult({
                        keyId: await this._calculateWalletId(),
                        keyPath: importedAccounts[0].path,
                        address: importedAccounts[0].address.serialize(),
                    }),
                },
            });
        } else {
            // TODO navigate to login success
            alert('Importing existing accounts not supported yet');
        }
        this.state = SignupLedger.State.IDLE;
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

    .loading-animation {
        opacity: 1;
        background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCIgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0Ij48c3R5bGU+QGtleWZyYW1lcyBhe3Rve3RyYW5zZm9ybTpyb3RhdGUoMjQwZGVnKSB0cmFuc2xhdGVaKDApO319I2NpcmNsZXthbmltYXRpb246MnMgYSBpbmZpbml0ZSBsaW5lYXI7dHJhbnNmb3JtOnJvdGF0ZSgtMTIwZGVnKSB0cmFuc2xhdGVaKDApO3RyYW5zZm9ybS1vcmlnaW46Y2VudGVyO308L3N0eWxlPjxkZWZzPjxjbGlwUGF0aCBpZD0iaGV4Q2xpcCI+PHBhdGggY2xpcC1ydWxlPSJldmVub2RkIiBkPSJtIDE5LjQ5MjE4OCwzLjUgYyAtMi40ODMxNTQsMCAtNC43OTAwMywxLjMwNTAwOSAtNi4wNTI3MzUsMy40MzU1NDY5IGwgLTAuMDAyLDAuMDA1ODYgTCAwLjk1MTE3MTg4LDI4LjI3MzQzOCBjIC0xLjI2Nzg5NDg1LDIuMTM5Mjk2IC0xLjI2NzIzMjE1LDQuODExNTk3IDAsNi45NTExNzEgMy4zMTI2ZS00LDUuNmUtNCAtMy4zMTQ0ZS00LDAuMDAxNCAwLDAuMDAyIEwgMTMuNDQ1MzEyLDU2LjUxOTUzMSBDIDE0LjY4NzkxMSw1OC42ODcxODggMTcuMDA5MDM1LDYwIDE5LjQ5MjE4OCw2MCBoIDI0Ljk5ODA0NiBjIDIuNDgzMTUzLDAgNC43OTAwMzEsLTEuMzA1MDA1IDYuMDUyNzM1LC0zLjQzNTU0NyBsIDAuMDAyLC0wLjAwMzkgMTIuNTA5NzY2LC0yMS4zMjQyMTkgYyAxLjI1NjQ3OSwtMi4xNDYyMDkgMS4yNjI3MDUsLTQuODE0ODMyIDAsLTYuOTUzMTI1IGwgLTAuMDAyLC0wLjAwMzkgLTEyLjQ4ODI4MSwtMjEuMzM3ODkwOCAtMC4wMDM5LC0wLjAwNTg2IEMgNDkuMjk3ODQzLDQuODA1MDA4NyA0Ni45OTA5NjcsMy41IDQ0LjUwNzgxMiwzLjUgWiBtIDAsNCBoIDI1LjAxNTYyNCBjIDEuMDc5ODI2LDAgMi4wNzM3OSwwLjU2OTU4MzMgMi42MTEzMjksMS40NzY1NjI1IGwgMTIuNDg2MzI4LDIxLjMzMjAzMTUgMC4wMDM5LDAuMDAzOSBjIDAuNTMyMDE2LDAuODk3NjYxIDAuNTM2MDgsMS45NzY2NTEgLTAuMDA1OSwyLjkwMjM0NCBsIC0xMi41MDE5NTQsMjEuMzA4NTk0IC0wLjAwMzksMC4wMDIgQyA0Ni41NTk2MTYsNTUuNDMwMjM2IDQ1LjU2ODYwNCw1NiA0NC40OTAyMzQsNTYgSCAxOS40OTIxODggYyAtMS4wNzk4MjYsMCAtMi4wNTc5ODYsLTAuNTYxMzkgLTIuNTc4MTI2LC0xLjQ2ODc1IGwgLTAuMDAzOSwtMC4wMDk4IC0xMi41MTU2MjQ4LC0yMS4zMzIwMzEgLTAuMDAxOTUsLTAuMDAyIGMgLTAuNTMyMDE1NywtMC44OTc2NjEgLTAuNTMyMDE1NywtMS45NzczMzkgMCwtMi44NzUgbCAwLjAwMTk1LC0wLjAwMzkgTCAxNi44ODA4NTksOC45NzY1NjI1IEMgMTcuNDE4Mzk5LDguMDY5NTgzIDE4LjQxMjM2Myw3LjUgMTkuNDkyMTg4LDcuNSBaIi8+PC9jbGlwUGF0aD48L2RlZnM+PHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBkPSJtIDE5LjQ5MjE4OCwzLjUgYyAtMi40ODMxNTQsMCAtNC43OTAwMywxLjMwNTAwOSAtNi4wNTI3MzUsMy40MzU1NDY5IGwgLTAuMDAyLDAuMDA1ODYgTCAwLjk1MTE3MTg4LDI4LjI3MzQzOCBjIC0xLjI2Nzg5NDg1LDIuMTM5Mjk2IC0xLjI2NzIzMjE1LDQuODExNTk3IDAsNi45NTExNzEgMy4zMTI2ZS00LDUuNmUtNCAtMy4zMTQ0ZS00LDAuMDAxNCAwLDAuMDAyIEwgMTMuNDQ1MzEyLDU2LjUxOTUzMSBDIDE0LjY4NzkxMSw1OC42ODcxODggMTcuMDA5MDM1LDYwIDE5LjQ5MjE4OCw2MCBoIDI0Ljk5ODA0NiBjIDIuNDgzMTUzLDAgNC43OTAwMzEsLTEuMzA1MDA1IDYuMDUyNzM1LC0zLjQzNTU0NyBsIDAuMDAyLC0wLjAwMzkgMTIuNTA5NzY2LC0yMS4zMjQyMTkgYyAxLjI1NjQ3OSwtMi4xNDYyMDkgMS4yNjI3MDUsLTQuODE0ODMyIDAsLTYuOTUzMTI1IGwgLTAuMDAyLC0wLjAwMzkgLTEyLjQ4ODI4MSwtMjEuMzM3ODkwOCAtMC4wMDM5LC0wLjAwNTg2IEMgNDkuMjk3ODQzLDQuODA1MDA4NyA0Ni45OTA5NjcsMy41IDQ0LjUwNzgxMiwzLjUgWiBtIDAsNCBoIDI1LjAxNTYyNCBjIDEuMDc5ODI2LDAgMi4wNzM3OSwwLjU2OTU4MzMgMi42MTEzMjksMS40NzY1NjI1IGwgMTIuNDg2MzI4LDIxLjMzMjAzMTUgMC4wMDM5LDAuMDAzOSBjIDAuNTMyMDE2LDAuODk3NjYxIDAuNTM2MDgsMS45NzY2NTEgLTAuMDA1OSwyLjkwMjM0NCBsIC0xMi41MDE5NTQsMjEuMzA4NTk0IC0wLjAwMzksMC4wMDIgQyA0Ni41NTk2MTYsNTUuNDMwMjM2IDQ1LjU2ODYwNCw1NiA0NC40OTAyMzQsNTYgSCAxOS40OTIxODggYyAtMS4wNzk4MjYsMCAtMi4wNTc5ODYsLTAuNTYxMzkgLTIuNTc4MTI2LC0xLjQ2ODc1IGwgLTAuMDAzOSwtMC4wMDk4IC0xMi41MTU2MjQ4LC0yMS4zMzIwMzEgLTAuMDAxOTUsLTAuMDAyIGMgLTAuNTMyMDE1NywtMC44OTc2NjEgLTAuNTMyMDE1NywtMS45NzczMzkgMCwtMi44NzUgbCAwLjAwMTk1LC0wLjAwMzkgTCAxNi44ODA4NTksOC45NzY1NjI1IEMgMTcuNDE4Mzk5LDguMDY5NTgzIDE4LjQxMjM2Myw3LjUgMTkuNDkyMTg4LDcuNSBaIiBmaWxsPSIjZmZmIiBvcGFjaXR5PSIuMiIvPjxnIGNsaXAtcGF0aD0idXJsKCNoZXhDbGlwKSI+PGNpcmNsZSBpZD0iY2lyY2xlIiBjeD0iMzIiIGN5PSIzMiIgcj0iMTYiIGZpbGw9Im5vbmUiIHN0cm9rZS13aWR0aD0iMzIiIHN0cm9rZT0iIzFERTlCNiIgc3Ryb2tlLWRhc2hhcnJheT0iMTYuNjY2IDg0LjY2NiIvPjwvZz48L3N2Zz4=');
        background-repeat: no-repeat;
        background-position: center;
        background-size: 100%;
        z-index: 1;
        display: block;
        height: 10rem;
        width: 10rem;
        margin: auto;
    }

    .ledger-ui {
        flex-grow: 1;
    }
</style>
