<template>
    <div class="success center">
        <div class="icon-checkmark-circle"></div>
        <h1>Your {{ requestKindString }}<br>was successfull!</h1>
        <div style="flex-grow: 1;"></div>
        <button @click="close">Back to store</button>
    </div>
</template>

<script lang="ts">
import {Component, Emit, Vue} from 'vue-property-decorator';
import {RequestType, ParsedCheckoutRequest} from '../lib/RequestTypes';
import {State} from 'vuex-class';

@Component({components: {}})
export default class Checkout extends Vue {
    @State('request') private request!: ParsedCheckoutRequest;

    private get requestKindString() {
        switch (this.request.kind) {
            case RequestType.CHECKOUT: return 'payment';
            default: return 'transaction';
        }
    }

    @Emit()
    private close() {
        window.close();
    }
}
</script>

<style scoped>
    .success {
        width: 100%;
        height: 100%;
        margin: 8px;
        box-sizing: border-box;
        background: #24bdb6;
        color: white;
    }

    .icon-checkmark-circle {
        width: 99px;
        height: 99px;
        margin-top: 96px;
        background-image: url();
        background-repeat: no-repeat;
        background-size: 100%;
    }

    h1 {
        font-size: 30px;
        font-weight: 300;
        line-height: 1.3;
        letter-spacing: 0.5px;
    }

    button {
        color: #2a60dd;
    }
</style>
