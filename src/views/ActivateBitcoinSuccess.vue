<template>
    <div class="container pad-bottom">
        <SmallPage>
            <StatusScreen
                :title="title"
                :state="state"
                :status="status"
                :lightBlue="true"
                :mainAction="action"
                @main-action="resolve"
                :message="message" />
        </SmallPage>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { State, Getter } from 'vuex-class';
import KeyguardClient from '@nimiq/keyguard-client';
import { SmallPage } from '@nimiq/vue-components';
import { ParsedSimpleRequest } from '../lib/RequestTypes';
import { WalletInfo } from '../lib/WalletInfo';
import { WalletStore } from '../lib/WalletStore';
import { Static } from '../lib/StaticStore';
import StatusScreen from '../components/StatusScreen.vue';
import WalletInfoCollector from '../lib/WalletInfoCollector';

@Component({components: {StatusScreen, SmallPage}})
export default class ActivateBitcoinSuccess extends Vue {
    @Static private request!: ParsedSimpleRequest;
    @State private keyguardResult!: KeyguardClient.DeriveBtcXPubResult;
    @Getter private findWallet!: (id: string) => WalletInfo | undefined;

    private walletInfo!: WalletInfo;
    private state: StatusScreen.State = StatusScreen.State.LOADING;
    private title: string = this.$root.$t('Fetching your addresses') as string;
    private status: string = this.$root.$t('Syncing with Bitcoin network...') as string;
    private message: string = '';
    private action: string = '';
    private receiptsError: Error | null = null;
    private resolve = () => {}; // tslint:disable-line:no-empty

    private async mounted() {
        const walletInfo = this.findWallet(this.request.walletId);

        if (!walletInfo) {
            throw new Error(`UNEXPECTED: accountId not found anymore in ActivateBitcoinSuccess (${this.request.walletId})`);
        }

        this.walletInfo = walletInfo;

        const btcAddresses = await WalletInfoCollector.detectBitcoinAddresses(this.keyguardResult.bitcoinXPub);

        this.walletInfo.btcXPub = this.keyguardResult.bitcoinXPub;
        this.walletInfo.btcAddresses = btcAddresses;

        WalletStore.Instance.put(this.walletInfo);

        // if (this.receiptsError) {
        //     this.title = this.$t('Your Addresses may be\nincomplete.') as string;
        //     this.state = StatusScreen.State.WARNING;
        //     this.message = this.$t('Used addresses without balance might have been missed.') as string;
        //     this.action = this.$t('Continue') as string;
        //     await new Promise((resolve) => { this.resolve = resolve; });
        // }

        const result = this.walletInfo.toAccountType();

        this.title = this.$t('Bitcoin activated') as string;
        this.state = StatusScreen.State.SUCCESS;
        setTimeout(() => { this.$rpc.resolve(result); }, StatusScreen.SUCCESS_REDIRECT_DELAY);
    }
}
</script>
