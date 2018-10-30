<template>
    <div class="checkout-success">
        <Network ref="network"/>
        <transition name='fade-out'>
            <div class="overview" v-if="!isTxSent">
                <h1>You're sending <Amount :amount="request.value + request.fee"/> to</h1>
                <Account :address="request.recipient" :label="originDomain"/>
                <div v-if="plainData" class="data">{{ plainData }}</div>
                <div class="sender-section">
                    <div class="sender-nav">
                        <h2>Pay with</h2>
                    </div>
                    <Account v-if="activeAccount" :address="activeAccount.address" :label="activeAccount.label" :balance="activeAccount.balance"/>
                </div>
            </div>
        </transition>
        <div class="transmission" v-if="!isTxSent">
                <div class="loading-spinner" />
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
import {Amount, Account} from '@nimiq/vue-components';
// import {RequestType, ParsedCheckoutRequest} from '../lib/RequestTypes';
import { SignTransactionResult, ParsedCheckoutRequest } from '@/lib/RequestTypes';
import {State as RpcState, ResponseStatus} from '@nimiq/rpc';
import {
    SignTransactionRequest as KSignTransactionRequest,
    SignTransactionResult as KSignTransactionResult,
} from '@nimiq/keyguard-client';
import {State, Getter} from 'vuex-class';
import {Static} from '../lib/StaticStore';
import {AddressInfo} from '../lib/AddressInfo';

@Component({components: {Network, Amount, Account}})
export default class CheckoutSuccess extends Vue {
    // @Static private request!: ParsedCheckoutRequest;
    @Static private rpcState!: RpcState;
    @Static private keyguardRequest!: KSignTransactionRequest;
    @Static private request!: ParsedCheckoutRequest;
    @State private keyguardResult!: KSignTransactionResult;

    @Getter private activeAccount!: AddressInfo | undefined;

    private result?: SignTransactionResult;
    private isTxSent: boolean = false;

    private get originDomain() {
        return this.rpcState.origin.split('://')[1];
    }

    private get plainData() {
        if (!this.request.data) return undefined;

        try {
            return Nimiq.BufferUtils.toAscii(this.request.data);
        } catch (err) {
            return undefined;
        }
    }

    private async mounted() {
        // TODO remove
        window.setTimeout(() => { this.isTxSent = true; }, 500);
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
    .checkout-success {
        display: flex;
        flex-direction: column;
        flex-grow: 1;
    }

    h1 {
        font-size: 3rem;
        line-height: 3.625rem;
        font-weight: 300;
        letter-spacing: 0.021em;
        margin: 4rem 4rem 1rem 4rem;
    }

    h1 .amount {
        font-weight: 500;
    }

    .data {
        font-size: 2rem;
        line-height: 1.3;
        opacity: 0.7;
        padding: 1rem 4rem;
    }

    .sender-section {
        margin-top: 3rem;
        padding-bottom: 2rem;
        border-top: solid 1px #f0f0f0;
        border-bottom: solid 1px #f0f0f0;
        background: #fafafa;
    }

    .sender-nav {
        padding: 2rem 2rem 1rem 2rem;
        display: flex;
        flex-direction: row;
        justify-content: space-between;
    }

    .sender-nav h2 {
        margin: 1rem;
        font-size: 1.75rem;
        text-transform: uppercase;
        line-height: 0.86;
        letter-spacing: 0.143em;
        font-weight: 400;
    }

    .sender-nav button {
        background: #e5e5e5;
        padding: 1rem 1.75rem;
        width: unset;
        font-size: 1.75rem;
        line-height: 0.86;
        box-shadow: unset;
        text-transform: unset;
        letter-spacing: normal;
        height: auto;
    }

    .transmission {
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

    .loading-spinner {
        width: 42px;
        height: 49px;
        transform: rotate(-90deg);
        border-radius: 4px;
        border-style: solid;
        border-width: 3px;
        border-image-source: conic-gradient(#1de9b6, rgba(41, 226, 174, 0) 19%, #f5af2d, rgba(247, 107, 28, 0) 100%, #1de9b6 19%, #1de9b6);
        border-image-slice: 1;
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
