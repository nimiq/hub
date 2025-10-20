<template>
    <NotEnoughCookieSpace v-if='notEnoughCookieSpace'/>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { Getter } from 'vuex-class';
import { BrowserDetection } from '@nimiq/utils';
import { ParsedSimpleRequest } from '../lib/RequestTypes';
import { Static } from '../lib/StaticStore';
import CookieHelper from '../lib/CookieHelper';
import NotEnoughCookieSpace from '../components/NotEnoughCookieSpace.vue';
import { POLYGON_ACCOUNT_KEY_PATH } from '../lib/polygon/PolygonConstants';
import { WalletInfo } from '../lib/WalletInfo';
import { WalletType } from '../lib/Constants';
import Config from 'config';

// Import only types to avoid bundling of KeyguardClient in Ledger request if not required.
// (But note that currently, the KeyguardClient is still always bundled in the RpcApi).
import type { DerivePolygonAddressRequest } from '@nimiq/keyguard-client';

@Component({components: {NotEnoughCookieSpace}})
export default class ActivatePolygon extends Vue {
    @Static private request!: ParsedSimpleRequest;
    @Getter private findWallet!: (id: string) => WalletInfo | undefined;

    private notEnoughCookieSpace = false;

    public async created() {
        try {
            const walletInfo = this.findWallet(this.request.walletId)!;

            if (walletInfo.type === WalletType.LEGACY) {
                throw new Error('Cannot enable Polygon for legacy accounts');
            }

            if (walletInfo.type === WalletType.LEDGER) {
                throw new Error('Cannot enable Polygon for Ledger accounts');
            }

            if (BrowserDetection.isIOS() || BrowserDetection.isSafari()) {
                // Dummy Polygon address, to test space in cookie
                const walletInfoEntry = {
                    ...walletInfo.toObject(),
                    polygonAddresses: [{
                        address: new Uint8Array(20),
                        path: 'not relevant',
                    }],
                };

                this.notEnoughCookieSpace = !(await CookieHelper.canFitNewWallets([walletInfoEntry]));
                if (this.notEnoughCookieSpace) return; // show error UI and don't continue
            }

            await this._startPolygonAddressRequest(walletInfo.keyId); // is async for ActivatePolygonLedger
        } catch (e) {
            this.$rpc.reject(e);
        }
    }

    protected _startPolygonAddressRequest(keyId: string) {
        // note that this method gets overwritten for ActivatePolygonLedger
        const keyguardRequest: DerivePolygonAddressRequest = {
            appName: this.request.appName,
            keyId,
            polygonAccountPath: POLYGON_ACCOUNT_KEY_PATH[Config.polygon.network],
        };

        const client = this.$rpc.createKeyguardClient(true);
        client.derivePolygonAddress(keyguardRequest);
    }
}
</script>
