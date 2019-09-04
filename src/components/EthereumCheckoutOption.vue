<script lang="ts">
import { State, Mutation, Getter } from 'vuex-class';
import bigInt from 'big-integer';
import { createEthereumRequestLink } from '@nimiq/utils';
import {
    EtherDirectPaymentOptions,
    ParsedEtherDirectPaymentOptions,
} from '../lib/paymentOptions/EtherPaymentOptions';
import NonNimiqCheckoutOption from './NonNimiqCheckoutOption.vue';

export default class EtherCheckoutOption
    extends NonNimiqCheckoutOption<ParsedEtherDirectPaymentOptions> {
    protected icon = 'icon-eth.svg';

    protected get paymentLink() {
        const paymentOptions = this.paymentOptions;
        const protocolSpecific = paymentOptions.protocolSpecific;
        if (!protocolSpecific.recipient) return '#';
        return createEthereumRequestLink(protocolSpecific.recipient, {
            amount: paymentOptions.amount,
            gasLimit: protocolSpecific.gasLimit,
            gasPrice: protocolSpecific.gasPrice,
        });
    }
}
</script>
