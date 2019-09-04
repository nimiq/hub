<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { State, Mutation, Getter } from 'vuex-class';
import CheckoutOption from './CheckoutOption.vue';
import {
    BitcoinDirectPaymentOptions,
    ParsedBitcoinDirectPaymentOptions,
} from '../lib/paymentOptions/BitcoinPaymentOptions';
import NonNimiqCheckoutOption from './NonNimiqCheckoutOption.vue';

export default class BitcoinCheckoutOption
    extends NonNimiqCheckoutOption<ParsedBitcoinDirectPaymentOptions> {
    protected icon = 'icon-btc.svg';

}
</script>
