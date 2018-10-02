<template>
    <div class="success center">
        <div class="icon-checkmark-circle"></div>
        <h1>Your payment<br>was successfull!</h1>
        <div style="flex-grow: 1;"></div>
        <button @click="done" :disabled="!isTxPrepared">Back to store</button>
        <TransactionSender ref="txSender"/>
    </div>
</template>

<script lang="ts">
import {Component, Emit, Vue} from 'vue-property-decorator';
import TransactionSender from '@/components/TransactionSender.vue';
// import {RequestType, ParsedCheckoutRequest} from '../lib/RequestTypes';
// import {State} from 'vuex-class';
// import {Static} from '../lib/StaticStore';

@Component({components: {TransactionSender}})
export default class CheckoutSuccess extends Vue {
    // @Static private request!: ParsedCheckoutRequest;

    private isTxPrepared: boolean = false;

    private async mounted() {
        await (this.$refs.txSender as TransactionSender).prepare();
        // this.isTxPrepared = true;
        (this.$refs.txSender as TransactionSender).send();
    }

    private done() {
        // (this.$refs.txSender as TransactionSender).send();
    }
}
</script>

<style scoped>
    .success {
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        align-items: center;
        flex-grow: 1;
        margin: 8px;
        background: #24bdb6;
        color: white;
        padding: 0 54px;
    }

    .icon-checkmark-circle {
        width: 99px;
        height: 99px;
        margin-top: 96px;
        background-image: url('data:image/svg+xml,<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 100 100" style="enable-background:new 0 0 100 100;" xml:space="preserve"><path d="M50,95C25.19,95,5,74.81,5,50S25.19,5,50,5s45,20.19,45,45S74.81,95,50,95z M50,0C22.43,0,0,22.43,0,50 s22.43,50,50,50s50-22.43,50-50S77.57,0,50,0z M81.41,29.11c-1.01-0.95-2.59-0.9-3.53,0.1L41.2,68.12L19.57,50.56 c-1.07-0.87-2.65-0.71-3.52,0.36c-0.87,1.07-0.71,2.65,0.36,3.52l23.44,19.02c0.46,0.38,1.02,0.56,1.58,0.56 c0.67,0,1.33-0.26,1.82-0.78l38.27-40.59C82.47,31.64,82.42,30.06,81.41,29.11z" fill="%23fff"/></svg>');
        background-repeat: no-repeat;
        background-size: 100%;
    }

    h1 {
        font-size: 30px;
        font-weight: 300;
        line-height: 1.3;
        letter-spacing: 0.5px;
        text-align: center;
    }

    button {
        color: #2a60dd;
        margin: 24px 0;
    }
</style>
