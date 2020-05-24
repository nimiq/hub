<template>
    <div class="container pad-bottom">
        <SmallPage>
            <StatusScreen
                :title="title"
                :status="status"
                :state="state"
                :message="message"
                mainAction="Reload"
                alternativeAction="Cancel"
                @main-action="reload"
                @alternative-action="cancel"
                lightBlue
            />
            <Network ref="network" :visible="false"/>
        </SmallPage>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { Static } from '../lib/StaticStore';
import { State } from 'vuex-class';
import { SmallPage } from '@nimiq/vue-components';
import Network from '../components/Network.vue';
import StatusScreen from '../components/StatusScreen.vue';
import KeyguardClient from '@nimiq/keyguard-client';
import { i18n } from '../i18n/i18n-setup';
import { ERROR_CANCELED } from '../lib/Constants';

@Component({components: {StatusScreen, Network, SmallPage}})
export default class CheckoutTransmission extends Vue {
    @Static private keyguardRequest!: KeyguardClient.SignTransactionRequest;
    @State private keyguardResult!: KeyguardClient.SignTransactionResult;

    private status: string = i18n.t('Connecting to network...') as string;
    private state = StatusScreen.State.LOADING;
    private message: string = '';

    private created() {
        const $subtitle = document.querySelector('.logo .logo-subtitle')!;
        $subtitle.textContent = 'Checkout';
    }

    private async mounted() {
        this.addConsensusListeners();
        const tx = await (this.$refs.network as Network).createTx(Object.assign({
            signerPubKey: this.keyguardResult.publicKey,
        }, this.keyguardResult, this.keyguardRequest));

        try {
            const result = await (this.$refs.network as Network).sendToNetwork(tx);
            this.state = StatusScreen.State.SUCCESS;

            setTimeout(() => this.$rpc.resolve(result), StatusScreen.SUCCESS_REDIRECT_DELAY);
        } catch (error) {
            this.state = StatusScreen.State.WARNING;
            this.message = error.message;
        }
    }

    private addConsensusListeners() {
        const network = (this.$refs.network as Network);
        network.$on(Network.Events.API_READY, () =>
            this.status = this.$t('Contacting seed nodes...') as string);
        network.$on(Network.Events.CONSENSUS_SYNCING, () =>
            this.status = this.$t('Syncing consensus...') as string);
        network.$on(Network.Events.CONSENSUS_ESTABLISHED, () =>
            this.status = this.$t('Sending transaction...') as string);
        network.$on(Network.Events.TRANSACTION_PENDING, () =>
            this.status = this.$t('Awaiting receipt confirmation...') as string);
    }

    private get title(): string {
        switch (this.state) {
            case StatusScreen.State.SUCCESS: return this.$t('Payment successful.') as string;
            case StatusScreen.State.WARNING: return 'Something went wrong';
            default: return this.$t('Processing your payment') as string;
        }
    }

    private reload() {
        window.location.reload();
    }

    private cancel() {
        this.$rpc.reject(new Error(ERROR_CANCELED));
    }
}
</script>

