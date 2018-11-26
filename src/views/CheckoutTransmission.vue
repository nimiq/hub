<template>
    <div class="checkout-transmission">
        <CheckoutDetails :accountChangeable="false"/>
        <PageFooter>
            <Network ref="network" :alwaysVisible="true" message="Sending transaction"/>
        </PageFooter>
        <transition name='fade-in'>
            <Success v-if="isTxSent"
                text="Your payment[br]was successful"
                :appName="keyguardRequest.appName"
                @continue="done" />
        </transition>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import Network from '@/components/Network.vue';
import { SignTransactionResult } from '@/lib/RequestTypes';
import CheckoutDetails from '../components/CheckoutDetails.vue';
import {
    SignTransactionRequest as KSignTransactionRequest,
    SignTransactionResult as KSignTransactionResult,
} from '@nimiq/keyguard-client';
import { State } from 'vuex-class';
import { Static } from '../lib/StaticStore';
import Success from '../components/Success.vue';
import { PageFooter } from '@nimiq/vue-components';

@Component({components: {PageFooter, Network, CheckoutDetails, Success}})
export default class CheckoutTransmission extends Vue {
    // The stored keyguardRequest does not have Uint8Array, only regular arrays
    @Static private keyguardRequest!: KSignTransactionRequest;
    @State private keyguardResult!: KSignTransactionResult;

    private result?: SignTransactionResult;
    private isTxSent: boolean = false;

    private async mounted() {
        const tx = await (this.$refs.network as Network).prepareTx(this.keyguardRequest, this.keyguardResult);
        this.result = await (this.$refs.network as Network).sendToNetwork(tx);
        this.isTxSent = true;
    }

    private done() {
        this.$rpc.resolve(this.result!);
    }
}
</script>

<style scoped>
    .checkout-transmission {
        display: flex;
        flex-direction: column;
        flex-grow: 1;
        position: relative;
    }

    .page-footer {
        padding: 1rem;
    }

    .success {
        position: absolute;
        bottom: 0;
        left: 0;
        height: calc(100% - 2rem);
        width: calc(100% - 2rem);
    }

    .fade-in-enter-active {
        animation: color-shift 1s;
    }

    @keyframes color-shift {
        0% {
            background: var(--nimiq-blue);
            background-image: var(--nimiq-blue-bg);
            max-height: 20rem;
        }

        100% {
            background: var(--nimiq-green);
            background-image: var(--nimiq-green-bg);
            max-height: 100%;
        }
    }
</style>
