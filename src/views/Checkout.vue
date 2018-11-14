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
import { Component, Emit, Vue } from 'vue-property-decorator';
import { PaymentInfoLine, SmallPage } from '@nimiq/vue-components';
import { ParsedCheckoutRequest } from '../lib/RequestTypes';
import { State as RpcState, ResponseStatus } from '@nimiq/rpc';
import { Static } from '../lib/StaticStore';

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
