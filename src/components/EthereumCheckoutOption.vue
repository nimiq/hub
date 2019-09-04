<script lang="ts">
import { State, Mutation, Getter } from 'vuex-class';
import bigInt from 'big-integer';
import {
    EtherDirectPaymentOptions,
    ParsedEtherDirectPaymentOptions,
} from '../lib/paymentOptions/EtherPaymentOptions';
import NonNimiqCheckoutOption from './NonNimiqCheckoutOption.vue';

export default class EtherCheckoutOption
    extends NonNimiqCheckoutOption<ParsedEtherDirectPaymentOptions> {
    protected icon = 'icon-eth.svg';
}
</script>
