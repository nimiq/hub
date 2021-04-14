<template>
    <NotEnoughCookieSpace v-if='notEnoughCookieSpace'/>
    <div v-else class="container">
        <SmallPage>
            <LedgerUi/>
        </SmallPage>

        <GlobalClose/>
    </div>
</template>

<script lang="ts">
import { Component } from 'vue-property-decorator';
import { SmallPage } from '@nimiq/vue-components';
import ActivateBitcoin from './ActivateBitcoin.vue';
import NotEnoughCookieSpace from '../components/NotEnoughCookieSpace.vue';
import GlobalClose from '../components/GlobalClose.vue';
import LedgerUi from '../components/LedgerUi.vue';
import LedgerApi from '@nimiq/ledger-api';
import Config from 'config';
import store from '../store';
import { RequestType } from '../lib/PublicRequestTypes';
import { BTC_ACCOUNT_KEY_PATH } from '../lib/bitcoin/BitcoinConstants';

type KeyguardDeriveBtcXPubResult = import('@nimiq/keyguard-client').DeriveBtcXPubResult;

@Component({components: {SmallPage, GlobalClose, LedgerUi, NotEnoughCookieSpace}})
export default class ActivateBitcoinLedger extends ActivateBitcoin {
    protected async _startBtcXpubRequest() {
        const bitcoinXPub = await LedgerApi.Bitcoin.getExtendedPublicKey(
            BTC_ACCOUNT_KEY_PATH[Config.bitcoinAddressType][Config.bitcoinNetwork].replace(/^m\//, ''),
        );

        // Mimic a keyguardResult to be able to reuse ActivateBitcoinSuccess
        const result: KeyguardDeriveBtcXPubResult = { bitcoinXPub };
        store.commit('setKeyguardResult', result);

        this.$router.replace({name: `${RequestType.ACTIVATE_BITCOIN}-success`});
    }
}
</script>
