<script lang="ts">
import { ParsedBitcoinDirectPaymentOptions } from '../lib/paymentOptions/BitcoinPaymentOptions';
import NonNimiqCheckoutOption from './NonNimiqCheckoutOption.vue';

export default class BitcoinCheckoutOption
    extends NonNimiqCheckoutOption<ParsedBitcoinDirectPaymentOptions> {
    protected icon = 'icon-btc.svg';
}
</script>
