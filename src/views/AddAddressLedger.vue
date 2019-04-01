<template>
    <div class="container">
        <SmallPage>
            <LedgerUi v-if="state === 'ledger-interaction'"></LedgerUi>
            <IdenticonSelector v-else-if="state === 'identicon-selection'" :accounts="addressesToSelectFrom"
                               :confirmAccountSelection="false" @identicon-selected="_onAddressSelected">
            </IdenticonSelector>
            <Loader v-if="state === 'finished'" state="success" title="Address Added"></Loader>
        </SmallPage>

        <button class="global-close nq-button-s" @click="close">
            <span class="nq-icon arrow-left"></span>
            Back to {{request.appName}}
        </button>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { PageBody, SmallPage } from '@nimiq/vue-components';
import LedgerUi from '../components/LedgerUi.vue';
import Loader from '../components/Loader.vue';
import IdenticonSelector from '../components/IdenticonSelector.vue';
import { Static } from '../lib/StaticStore';
import { ParsedSimpleRequest } from '../lib/RequestTypes';
import { Address } from '../lib/PublicRequestTypes';
import { WalletInfo } from '../lib/WalletInfo';
import { AccountInfo } from '../lib/AccountInfo';
import LedgerApi from '../lib/LedgerApi';
import { WalletStore } from '../lib/WalletStore';
import { ACCOUNT_MAX_ALLOWED_ADDRESS_GAP, ERROR_CANCELED } from '../lib/Constants';
import LabelingMachine from '../lib/LabelingMachine';

@Component({components: {PageBody, SmallPage, LedgerUi, Loader, IdenticonSelector}})
export default class AddAddressLedger extends Vue {
    private static readonly State = {
        LEDGER_INTERACTION: 'ledger-interaction', // can be instructions to connect or also display of an error
        IDENTICON_SELECTION: 'identicon-selection',
        FINISHED: 'finished',
    };

    @Static private request!: ParsedSimpleRequest;

    private state: string = AddAddressLedger.State.LEDGER_INTERACTION;
    private account!: WalletInfo;
    private addressesToSelectFrom: AccountInfo[] = [];

    private async created() {
        // called every time the router shows this page
        const account = await WalletStore.Instance.get(this.request.walletId);
        if (!account) {
            this.$rpc.reject(new Error('Account ID not found'));
            return;
        }
        this.account = account;

        let startIndex = 0;
        const newestAddress = Array.from(account.accounts.values()).pop();
        if (newestAddress) {
            const newestIndex = LedgerApi.getKeyIdForBip32Path(newestAddress.path);
            startIndex = (newestIndex !== null ? newestIndex : -1) + 1;
        }

        const pathsToDerive = [];
        for (let keyId = startIndex; keyId < startIndex + ACCOUNT_MAX_ALLOWED_ADDRESS_GAP; ++keyId) {
            pathsToDerive.push(LedgerApi.getBip32PathForKeyId(keyId));
        }

        const derivedAddressInfos = await LedgerApi.deriveAccounts(pathsToDerive, this.request.walletId);
        this.addressesToSelectFrom = derivedAddressInfos.map((addressInfo) => new AccountInfo(
            addressInfo.keyPath,
            LabelingMachine.labelAddress(addressInfo.address),
            Nimiq.Address.fromUserFriendlyAddress(addressInfo.address),
            0, // balance 0 because user selects from unused addresses
        ));
        this.state = AddAddressLedger.State.IDENTICON_SELECTION;
    }

    private destroyed() {
        const currentRequest = LedgerApi.currentRequest;
        if (currentRequest && currentRequest.type === LedgerApi.RequestType.DERIVE_ACCOUNTS) {
            currentRequest.cancel();
        }
    }

    private async _onAddressSelected(selectedAccount: AccountInfo) {
        const userFriendlyAddress = selectedAccount.userFriendlyAddress;
        this.account.accounts.set(userFriendlyAddress, selectedAccount);
        await WalletStore.Instance.put(this.account);

        this.state = AddAddressLedger.State.FINISHED;
        await new Promise((resolve) => setTimeout(resolve, Loader.SUCCESS_REDIRECT_DELAY));
        const result: Address = {
            address: userFriendlyAddress,
            label: selectedAccount.label,
        };
        this.$rpc.resolve(result);
    }

    private close() {
        this.$rpc.reject(new Error(ERROR_CANCELED));
    }
}
</script>

<style scoped>
    .small-page > * {
        flex-grow: 1;
    }
</style>
