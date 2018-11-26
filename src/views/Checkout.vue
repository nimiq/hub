<template>
    <div class="container">
        <PaymentInfoLine v-if="rpcState"
                         :amount="request.value"
                         :networkFee="request.fee"
                         :networkFeeEditable="false"
                         :origin="rpcState.origin"/>
        <SmallPage>
            <router-view/>
        </SmallPage>
        <button class="global-close nq-button-s" :class="{'hidden': $route.name === 'checkout-success'}" @click="close">
            <span class="nq-icon arrow-left"></span>
            Cancel Payment
        </button>
    </div>
</template>

<script lang="ts">
import { Component, Emit, Vue } from 'vue-property-decorator';
import { PaymentInfoLine, SmallPage } from '@nimiq/vue-components';
import { ParsedCheckoutRequest } from '../lib/RequestTypes';
import { Static } from '../lib/StaticStore';

@Component({components: {PaymentInfoLine, SmallPage}})
export default class Checkout extends Vue {
    @Static private request!: ParsedCheckoutRequest;

    @Emit()
    private close() {
        this.$rpc.reject(new Error('CANCEL'));
    }
}
</script>
