<template>
    <div class="checkout-transmission">
        <Network ref="network"/>
        <transition name='fade-out'>
            <CheckoutDetails v-if="!isTxSent" :accountChangeable="false"/>
        </transition>
        <div class="loading-container" v-if="!isTxSent">
            <LoadingSpinner />
        </div>
        <transition name='fade-in'>
            <div class="success center" v-if="isTxSent">
                <div class="icon-checkmark-circle"></div>
                <h1>Your payment was successful!</h1>
                <div style="flex-grow: 1;"></div>
                <button @click="done">Back to store</button>
            </div>
        </transition>
    </div>
</template>

<script lang="ts">
import {Component, Emit, Vue} from 'vue-property-decorator';
import Network from '@/components/Network.vue';
import { SignTransactionResult, ParsedCheckoutRequest } from '@/lib/RequestTypes';
import CheckoutDetails from '../components/CheckoutDetails.vue';
import {LoadingSpinner} from '@nimiq/vue-components';
import {State as RpcState, ResponseStatus} from '@nimiq/rpc';
import {
    SignTransactionRequest as KSignTransactionRequest,
    SignTransactionResult as KSignTransactionResult,
} from '@nimiq/keyguard-client';
import {State, Getter} from 'vuex-class';
import {Static} from '../lib/StaticStore';
import {AddressInfo} from '../lib/AddressInfo';

@Component({components: {Network, CheckoutDetails, LoadingSpinner}})
export default class CheckoutTransmission extends Vue {
    @Static private rpcState!: RpcState;
    @Static private keyguardRequest!: KSignTransactionRequest;
    @State private keyguardResult!: KSignTransactionResult;

    @Getter private activeAccount!: AddressInfo | undefined;

    private result?: SignTransactionResult;
    private isTxSent: boolean = false;

    private async mounted() {
        const tx = await (this.$refs.network as Network).prepareTx(this.keyguardRequest, this.keyguardResult);
        this.result = await (this.$refs.network as Network).sendToNetwork(tx);
        this.isTxSent = true;
    }

    private done() {
        this.rpcState.reply(ResponseStatus.OK, this.result);
    }
}
</script>

<style scoped>
    .checkout-transmission {
        display: flex;
        flex-direction: column;
        flex-grow: 1;
    }

    .loading-container {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        flex-grow: 1;
        margin: 1rem;
        height: 150px;
        border-radius: 4px;
        background: #6843df;
    }

    .success {
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        align-items: center;
        align-self: flex-end;
        flex-grow: 1;
        margin: 1rem;
        color: white;
        padding: 0 6.75rem;
        background: #24bdb6;
        overflow: hidden;
    }

    .icon-checkmark-circle {
        width: 12.375rem;
        height: 12.375rem;
        margin-top: 12rem;
        background-image: url('data:image/svg+xml,<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 100 100" style="enable-background:new 0 0 100 100;" xml:space="preserve"><path d="M50,95C25.19,95,5,74.81,5,50S25.19,5,50,5s45,20.19,45,45S74.81,95,50,95z M50,0C22.43,0,0,22.43,0,50 s22.43,50,50,50s50-22.43,50-50S77.57,0,50,0z M81.41,29.11c-1.01-0.95-2.59-0.9-3.53,0.1L41.2,68.12L19.57,50.56 c-1.07-0.87-2.65-0.71-3.52,0.36c-0.87,1.07-0.71,2.65,0.36,3.52l23.44,19.02c0.46,0.38,1.02,0.56,1.58,0.56 c0.67,0,1.33-0.26,1.82-0.78l38.27-40.59C82.47,31.64,82.42,30.06,81.41,29.11z" fill="%23fff"/></svg>');
        background-repeat: no-repeat;
        background-size: 100%;
    }

    .fade-in-enter-active {
        animation: enter 1s;
    }

    @keyframes enter {
        0% {
            background: #6843df;
            height: fit-content;
            max-height: 150px;
        }

        100% {
            background: #24bdb6;
            max-height: 450px;
        }
    }

    .fade-out-leave-active {
        animation: leave 0.8s;
    }

    @keyframes leave {
        0% {
            max-height: 500px;
            opacity: 1;
        }

        100% {
            max-height: 0;
            opacity: 0;
        }
    }

    .success h1 {
        font-size: 3.75rem;
        font-weight: 300;
        line-height: 1.3;
        letter-spacing: 0.017em;
        text-align: center;
    }

    .success button {
        color: #2a60dd;
        margin: 3rem 0;
    }
</style>
