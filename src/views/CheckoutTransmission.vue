<template>
    <div class="container pad-bottom">
        <SmallPage>
            <Loader :title="title" :status="status" :state="state" :lightBlue="true"/>
            <Network :visible="false" ref="network"/>
        </SmallPage>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { SignTransactionResult } from '@/lib/RequestTypes';
import { Static } from '../lib/StaticStore';
import { State } from 'vuex-class';
import { SmallPage } from '@nimiq/vue-components';
import Network from '@/components/Network.vue';
import Loader from '../components/Loader.vue';

@Component({components: {Loader, Network, SmallPage}})
export default class CheckoutTransmission extends Vue {
    // The stored keyguardRequest does not have Uint8Arrays, only regular arrays
    @Static private keyguardRequest!: KeyguardRequest.SignTransactionRequest;
    @State private keyguardResult!: KeyguardRequest.SignTransactionResult;

    private isTxSent: boolean = false;

    private async mounted() {
        const tx = await (this.$refs.network as Network).prepareTx(this.keyguardRequest, this.keyguardResult);
        const result: SignTransactionResult = await (this.$refs.network as Network).sendToNetwork(tx);
        this.isTxSent = true;

        setTimeout(() => this.$rpc.resolve(result), Loader.SUCCESS_REDIRECT_DELAY);
    }

    private get status(): string {
        return 'Connecting to Nimiq...';
    }

    private get state(): Loader.State {
        return !this.isTxSent ? Loader.State.LOADING : Loader.State.SUCCESS;
    }

    private get title(): string {
        return !this.isTxSent ? 'Processing your payment' : 'Payment successful.';
    }
}
</script>

<style scoped>
    .small-page {
        height: 70rem;
    }
</style>
