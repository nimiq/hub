<template>
    <div class="container">
        <SmallPage>
            <StatusScreen
                :title="title"
                :state="state"
                :status="status"
                :lightBlue="!isLedgerAccount"
                :mainAction="action"
                @main-action="_reload"
                :message="message" />
        </SmallPage>

        <GlobalClose :hidden="isGlobalCloseHidden" />
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { State, Getter } from 'vuex-class';
import KeyguardClient from '@nimiq/keyguard-client';
import { SmallPage } from '@nimiq/vue-components';
import { ParsedSimpleRequest } from '../lib/RequestTypes';
import { WalletType } from '../lib/Constants';
import { WalletInfo } from '../lib/WalletInfo';
import { WalletStore } from '../lib/WalletStore';
import { Static } from '../lib/StaticStore';
import StatusScreen from '../components/StatusScreen.vue';
import GlobalClose from '../components/GlobalClose.vue';
import WalletInfoCollector from '../lib/WalletInfoCollector';

@Component({components: {StatusScreen, SmallPage, GlobalClose}})
export default class ActivateBitcoinSuccess extends Vue {
    @Static private request!: ParsedSimpleRequest;
    @State private keyguardResult!: KeyguardClient.DeriveBtcXPubResult;
    @Getter private findWallet!: (id: string) => WalletInfo | undefined;

    private state: StatusScreen.State = StatusScreen.State.LOADING;
    private title: string = this.$root.$t('Fetching your Addresses') as string;
    private status: string = '';
    private message: string = '';
    private action: string = '';
    private isLedgerAccount: boolean = false;
    private isGlobalCloseHidden: boolean = false;

    private async created() {
        const walletInfo = this.findWallet(this.request.walletId);

        if (!walletInfo) {
            throw new Error(`UNEXPECTED: accountId not found anymore in ActivateBitcoinSuccess (${this.request.walletId})`);
        }

        this.isLedgerAccount = walletInfo.type === WalletType.LEDGER;

        if (!this.isLedgerAccount) {
            // For non-Ledger accounts immediately set UI state without transitioning
            this.isGlobalCloseHidden = true;
            this.status = this.$root.$t('Syncing with Bitcoin network...') as string;
        }

        let btcAddresses;
        try {
            btcAddresses = await WalletInfoCollector.detectBitcoinAddresses(this.keyguardResult.bitcoinXPub);
        } catch (e) {
            this.state = StatusScreen.State.ERROR;
            this.title = this.$t('Syncing Failed') as string;
            this.message = this.$t('Syncing with Bitcoin network failed: {error}', { error: e.message || e }) as string;
            this.action = this.$t('Retry') as string;
            return;
        }

        walletInfo.btcXPub = this.keyguardResult.bitcoinXPub;
        walletInfo.btcAddresses = btcAddresses;

        WalletStore.Instance.put(walletInfo);

        const result = walletInfo.toAccountType();

        this.title = this.$t('Bitcoin activated') as string;
        this.state = StatusScreen.State.SUCCESS;
        setTimeout(() => { this.$rpc.resolve(result); }, StatusScreen.SUCCESS_REDIRECT_DELAY);
    }

    private mounted() {
        if (!this.isLedgerAccount) return;
        requestAnimationFrame(() => {
            // For Ledger transition UI after first rendering a state that replicates ActivateBitcoinLedger for a smooth
            // transition between the two views.
            this.isGlobalCloseHidden = true;
            this.status = this.$root.$t('Syncing with Bitcoin network...') as string;
        });
    }

    private _reload() {
        window.location.reload();
    }
}
</script>
