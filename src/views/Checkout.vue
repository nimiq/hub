<template>
    <div class="container">
        <PaymentInfoLine v-if="rpcState" style="color: white"
                         :amount="request.value"
                         :networkFee="request.fee"
                         :networkFeeEditable="false"
                         :origin="rpcState.origin"/>
        <small-page>
            <router-view/>
        </small-page>
        <a class="global-close" :class="{hidden: $route.name === `checkout-success`}" @click="close">Cancel Payment</a>
    </div>
</template>

<script lang="ts">
import {Component, Emit, Vue} from 'vue-property-decorator';
import {PaymentInfoLine, SmallPage} from '@nimiq/vue-components';
import {ParsedCheckoutRequest} from '../lib/RequestTypes';
import {State as RpcState, ResponseStatus} from '@nimiq/rpc';
import {Static} from '../lib/StaticStore';

@Component({components: {PaymentInfoLine, SmallPage}})
export default class Checkout extends Vue {
    @Static private rpcState!: RpcState;
    @Static private request!: ParsedCheckoutRequest;

    @Emit()
    private close() {
        this.rpcState.reply(ResponseStatus.ERROR, new Error('CANCEL'));
    }
}
</script>

<style scoped>
    .container {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
    }

    .global-close {
        display: inline-block;
        height: 27px;
        border-radius: 13.5px;
        background-color: rgba(0, 0, 0, 0.1);
        font-size: 14px;
        font-weight: 600;
        line-height: 27px;
        color: white;
        padding: 0 12px;
        cursor: pointer;
        margin-top: 64px;
        margin-bottom: 40px;
    }

    .global-close::before {
        content: '';
        display: inline-block;
        height: 11px;
        width: 11px;
        background-image: url('data:image/svg+xml,<svg height="24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M0 0h24v24H0z" fill="none"/><path fill="%23fff" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>');
        background-repeat: no-repeat;
        background-size: 16px;
        background-position: center;
        margin-right: 8px;
        margin-bottom: -1px;
    }

    .global-close.hidden {
        visibility: hidden;
        pointer-events: none;
    }
</style>
