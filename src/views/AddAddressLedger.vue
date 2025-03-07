<template>
    <div class="container">
        <SmallPage>
            <transition name="transition-fade">
                <LedgerUi v-if="state === constructor.State.LEDGER_INTERACTION"/>
            </transition>
            <transition name="transition-fade">
                <IdenticonSelector v-if="state === constructor.State.IDENTICON_SELECTION
                                   || state === constructor.State.FINISHED"
                                   :accounts="addressesToSelectFrom"
                                   :confirmButtonText="$t('Add to Ledger')"
                                   @identicon-selected="_onAddressSelected">
                    <PageHeader slot="header">{{ $t('Choose a new Address') }}</PageHeader>
                </IdenticonSelector>
            </transition>
            <StatusScreen v-if="state === constructor.State.FINISHED" state="success" :title="$t('Address Added')"
                    class="grow-from-bottom-button">
            </StatusScreen>
        </SmallPage>

        <GlobalClose />
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { PageBody, SmallPage, PageHeader } from '@nimiq/vue-components';
import Config from 'config';
import StatusScreen from '../components/StatusScreen.vue';
import GlobalClose from '../components/GlobalClose.vue';
import LedgerUi from '../components/LedgerUi.vue';
import IdenticonSelector from '../components/IdenticonSelector.vue';
import { Static } from '../lib/StaticStore';
import { ParsedSimpleRequest } from '../lib/RequestTypes';
import { Address } from '../../client/PublicRequestTypes';
import { WalletInfo } from '../lib/WalletInfo';
import { AccountInfo } from '../lib/AccountInfo';
import LedgerApi, {
    Coin,
    getBip32Path,
    parseBip32Path,
    RequestTypeNimiq as LedgerApiRequestType,
} from '@nimiq/ledger-api';
import { WalletStore } from '../lib/WalletStore';
import { ACCOUNT_MAX_ALLOWED_ADDRESS_GAP } from '../lib/Constants';
import { labelAddress } from '../lib/LabelingMachine';

@Component({components: {
    PageBody,
    SmallPage,
    PageHeader,
    StatusScreen,
    GlobalClose,
    LedgerUi,
    IdenticonSelector,
}})
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
        const account = (await WalletStore.Instance.get(this.request.walletId))!;
        this.account = account;

        let startIndex = 0;
        const newestAddress = Array.from(account.accounts.values()).pop();
        if (newestAddress) {
            try {
                startIndex = parseBip32Path(newestAddress.path).addressIndex + 1;
            } catch (e) {
                // Ignore and start at index 0. Should never happen.
            }
        }

        const pathsToDerive = [];
        for (let keyId = startIndex; keyId < startIndex + ACCOUNT_MAX_ALLOWED_ADDRESS_GAP; ++keyId) {
            pathsToDerive.push(getBip32Path({
                coin: Coin.NIMIQ,
                addressIndex: keyId,
            }));
        }

        const derivedAddressInfos = await LedgerApi.Nimiq.deriveAddresses(
            pathsToDerive,
            this.account.keyId,
            Config.ledgerApiNimiqVersion,
        );
        this.addressesToSelectFrom = derivedAddressInfos.map((addressInfo) => new AccountInfo(
            addressInfo.keyPath,
            labelAddress(addressInfo.address),
            Nimiq.Address.fromString(addressInfo.address),
            0, // balance 0 because user selects from unused addresses
        ));
        this.state = AddAddressLedger.State.IDENTICON_SELECTION;
    }

    private destroyed() {
        LedgerApi.disconnect(
            /* cancelRequest */ true,
            /* requestTypeToDisconnect */ LedgerApiRequestType.DERIVE_ADDRESSES,
        );
    }

    private async _onAddressSelected(selectedAccount: AccountInfo) {
        const userFriendlyAddress = selectedAccount.userFriendlyAddress;
        this.account.accounts.set(userFriendlyAddress, selectedAccount);
        await WalletStore.Instance.put(this.account);

        this.state = AddAddressLedger.State.FINISHED;
        await new Promise((resolve) => setTimeout(resolve, StatusScreen.SUCCESS_REDIRECT_DELAY));
        const result: Address = {
            address: userFriendlyAddress,
            label: selectedAccount.label,
        };
        this.$rpc.resolve(result);
    }
}
</script>

<style scoped>
    .small-page {
        overflow: hidden;
        position: relative;
    }

    .small-page > * {
        position: absolute;
        left: 0;
        bottom: 0;
        width: 100%;
        height: 100%;
        transition: opacity .4s;
    }
</style>
