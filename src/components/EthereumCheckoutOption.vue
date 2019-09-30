<script lang="ts">
import { ParsedEtherDirectPaymentOptions } from '../lib/paymentOptions/EtherPaymentOptions';
import NonNimiqCheckoutOption from './NonNimiqCheckoutOption.vue';

export default class EtherCheckoutOption
    extends NonNimiqCheckoutOption<ParsedEtherDirectPaymentOptions> {
    protected icon = 'icon-eth.svg';
}
</script>
