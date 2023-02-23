<template>
    <NotEnoughCookieSpace v-if='notEnoughCookieSpace'/>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import KeyguardClient from '@nimiq/keyguard-client';
import { BrowserDetection } from '@nimiq/utils';
import { ParsedBasicRequest } from '../lib/RequestTypes';
import { Static } from '../lib/StaticStore';
import { DEFAULT_KEY_PATH } from '@/lib/Constants';
import CookieHelper from '../lib/CookieHelper';
import NotEnoughCookieSpace from '../components/NotEnoughCookieSpace.vue';
import { BTC_ACCOUNT_KEY_PATH } from '../lib/bitcoin/BitcoinConstants';
import { POLYGON_ACCOUNT_KEY_PATH } from '../lib/polygon/PolygonConstants';
import Config from 'config';

@Component({components: {NotEnoughCookieSpace}})
export default class Login extends Vue {
    @Static private request!: ParsedBasicRequest;

    private notEnoughCookieSpace = false;

    public async created() {
        if ((BrowserDetection.isIOS() || BrowserDetection.isSafari()) && !await CookieHelper.canFitNewWallets()) {
            this.notEnoughCookieSpace = true;
            return;
        }

        const request: KeyguardClient.ImportRequest = {
            appName: this.request.appName,
            requestedKeyPaths: [DEFAULT_KEY_PATH],
            bitcoinXPubPath: BTC_ACCOUNT_KEY_PATH[Config.bitcoinAddressType][Config.bitcoinNetwork],
            polygonAccountPath: POLYGON_ACCOUNT_KEY_PATH[Config.polygonNetwork],
        };

        const client = this.$rpc.createKeyguardClient(true);
        client.import(request);
    }
}
</script>
