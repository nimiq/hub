<template>
    <div class="container pad-bottom">
        <SmallPage>
            <StatusScreen :title="title" :status="status" :state="state" :lightBlue="true"/>
            <Network ref="network" :visible="false"/>
        </SmallPage>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { Static } from '../lib/StaticStore';
import { State } from 'vuex-class';
import { SmallPage } from '@nimiq/vue-components';
import Network from '@/components/Network.vue';
import StatusScreen from '../components/StatusScreen.vue';
import KeyguardClient from '@nimiq/keyguard-client';

@Component({components: {StatusScreen, Network, SmallPage}})
export default class CheckoutTransmission extends Vue {
    @Static private keyguardRequest!: KeyguardClient.SignTransactionRequest;
    @State private keyguardResult!: KeyguardClient.SignTransactionResult;

    private isTxSent: boolean = false;

    private created() {
        const $subtitle = document.querySelector('.logo .logo-subtitle')!;
        $subtitle.textContent = 'Checkout';
    }

    private async mounted() {
        const tx = await (this.$refs.network as Network).createTx(Object.assign({
            signerPubKey: this.keyguardResult.publicKey,
        }, this.keyguardResult, this.keyguardRequest));
        const result = await (this.$refs.network as Network).sendToNetwork(tx);
        this.isTxSent = true;

        setTimeout(() => this.$rpc.resolve(result), StatusScreen.SUCCESS_REDIRECT_DELAY);
    }

    private get status(): string {
        return 'Connecting to Nimiq...';
    }

    private get state(): StatusScreen.State {
        return !this.isTxSent ? StatusScreen.State.LOADING : StatusScreen.State.SUCCESS;
    }

    private get title(): string {
        return !this.isTxSent ? 'Processing your payment' : 'Payment successful.';
    }
}
</script>

