<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { State, Mutation, Getter } from 'vuex-class';
import { createBitcoinRequestLink } from '@nimiq/utils';
import staticStore from '../lib/StaticStore';
import CheckoutOption from './CheckoutOption.vue';
import {
    BitcoinDirectPaymentOptions,
    ParsedBitcoinDirectPaymentOptions,
} from '../lib/paymentOptions/BitcoinPaymentOptions';
import NonNimiqCheckoutOption from './NonNimiqCheckoutOption.vue';

export default class BitcoinCheckoutOption
    extends NonNimiqCheckoutOption<ParsedBitcoinDirectPaymentOptions> {
    protected icon = 'icon-btc.svg';

    protected get paymentLink() {
        const paymentOptions = this.paymentOptions;
        const protocolSpecific = paymentOptions.protocolSpecific;
        if (!protocolSpecific.recipient) return '#';
        return createBitcoinRequestLink(protocolSpecific.recipient, {
            amount: paymentOptions.amount,
            fee: protocolSpecific.fee,
            label: staticStore.request ? `Nimiq Checkout - ${staticStore.request.appName}` : undefined,
        });
    }
}
</script>
