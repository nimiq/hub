<script lang="ts">
import { createEthereumRequestLink } from '@nimiq/utils';
import { ParsedEtherDirectPaymentOptions } from '../lib/paymentOptions/EtherPaymentOptions';
import NonNimiqCheckoutOption from './NonNimiqCheckoutOption.vue';
import { FormattableNumber } from '@nimiq/utils';

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

    protected get manualPaymentDetails() {
        const paymentDetails = [ ...super.manualPaymentDetails, {
            label: 'Amount',
            value: {
                ETH: new FormattableNumber(this.paymentOptions.amount)
                    .moveDecimalSeparator(-this.paymentOptions.decimals).toString(),
            },
        }];
        if (this.paymentOptions.protocolSpecific.gasPrice) {
            paymentDetails.push({
                label: 'Gas Price',
                value: {
                    GWEI: new FormattableNumber(this.paymentOptions.protocolSpecific.gasPrice)
                        .moveDecimalSeparator(-9).toString({ maxDecimals: 2 }),
                    ETH: new FormattableNumber(this.paymentOptions.protocolSpecific.gasPrice)
                        .moveDecimalSeparator(-this.paymentOptions.decimals).toString(),
                },
            });
        }
        if (this.paymentOptions.protocolSpecific.gasLimit) {
            paymentDetails.push({
                label: 'Gas Limit',
                value: this.paymentOptions.protocolSpecific.gasLimit,
            });
        }
        return paymentDetails;
    }
}
</script>
