<template>
    <NotEnoughCookieSpace v-if='notEnoughCookieSpace'/>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { State } from 'vuex-class';
import KeyguardClient, { Errors } from '@nimiq/keyguard-client';
import { BrowserDetection } from '@nimiq/utils';
import { ParsedBasicRequest } from '../lib/RequestTypes';
import { Static } from '../lib/StaticStore';
import { DEFAULT_KEY_PATH } from '@/lib/Constants';
import CookieHelper from '../lib/CookieHelper';
import NotEnoughCookieSpace from '../components/NotEnoughCookieSpace.vue';
import { BTC_ACCOUNT_KEY_PATH } from '../lib/bitcoin/BitcoinConstants';
import Config from 'config';

@Component({components: {NotEnoughCookieSpace}})
export default class Signup extends Vue {
    @Static private request!: ParsedBasicRequest;
    @State private keyguardResult?: Error;

    private notEnoughCookieSpace = false;

    public async created() {
        if ((BrowserDetection.isIOS() || BrowserDetection.isSafari()) && !await CookieHelper.canFitNewWallets()) {
            this.notEnoughCookieSpace = true;
            return;
        }

        const request: KeyguardClient.CreateRequest = {
            appName: this.request.appName,
            defaultKeyPath: DEFAULT_KEY_PATH,
            enableBackArrow: (this.keyguardResult && this.keyguardResult.message === Errors.Messages.GOTO_CREATE)
                ? true
                : false,
            bitcoinXPubPath: BTC_ACCOUNT_KEY_PATH[Config.bitcoinAddressType][Config.bitcoinNetwork],
        };
        const client = this.$rpc.createKeyguardClient(true);
        client.create(request);
    }
}
</script>
