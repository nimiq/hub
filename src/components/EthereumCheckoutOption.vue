<script lang="ts">
import { createEthereumRequestLink } from '@nimiq/utils';
import { ParsedEtherDirectPaymentOptions } from '../lib/paymentOptions/EtherPaymentOptions';
import NonNimiqCheckoutOption from './NonNimiqCheckoutOption.vue';

export default class EtherCheckoutOption
    extends NonNimiqCheckoutOption<ParsedEtherDirectPaymentOptions> {
    protected currencyFullName = 'Ethereum';
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
