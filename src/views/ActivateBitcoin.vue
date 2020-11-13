<template>
    <NotEnoughCookieSpace v-if='notEnoughCookieSpace'/>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { Getter } from 'vuex-class';
import KeyguardClient from '@nimiq/keyguard-client';
import { BrowserDetection } from '@nimiq/utils';
import { ParsedSimpleRequest } from '../lib/RequestTypes';
import { Static } from '../lib/StaticStore';
import CookieHelper from '../lib/CookieHelper';
import NotEnoughCookieSpace from '../components/NotEnoughCookieSpace.vue';
import { BTC_ACCOUNT_KEY_PATH } from '../lib/bitcoin/BitcoinConstants';
import { WalletInfo } from '../lib/WalletInfo';
import { WalletType } from '../lib/Constants';
import Config from 'config';

@Component({components: {NotEnoughCookieSpace}})
export default class ActivateBitcoin extends Vue {
    @Static private request!: ParsedSimpleRequest;
    @Getter private findWallet!: (id: string) => WalletInfo | undefined;

    private notEnoughCookieSpace = false;

    public async created() {
        const walletInfo = this.findWallet(this.request.walletId)!;

        if (walletInfo.type === WalletType.LEGACY) {
            throw new Error('Cannot enable Bitcoin for legacy accounts');
        }

        if (BrowserDetection.isIOS() || BrowserDetection.isSafari()) {
            // Dummy xpub, to test space in cookie
            const walletInfoEntry = {
                ...walletInfo.toObject(),
                btcXPub: 'xpub6H1LXWLaKsWFhvm6RVpEL9P4KfRZSW7abD2ttkWP3SSQvnyA8FSVqNTEcYFgJS2UaFcxupHiYkro49S8yGasTvXEYBVPamhGW6cFJodrTHy',
            };

            if (!(await CookieHelper.canFitNewWallets([walletInfoEntry]))) {
                this.notEnoughCookieSpace = true;
                return;
            }
        }

        const request: KeyguardClient.DeriveBtcXPubRequest = {
            appName: this.request.appName,
            keyId: walletInfo.keyId,
            bitcoinXPubPath: BTC_ACCOUNT_KEY_PATH[Config.bitcoinAddressType][Config.bitcoinNetwork],
        };

        const client = this.$rpc.createKeyguardClient(true);
        client.deriveBtcXPub(request);
    }
}
</script>
