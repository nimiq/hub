<script lang="ts">
import { createEthereumRequestLink } from '@nimiq/utils';
import { ParsedEtherDirectPaymentOptions } from '../lib/paymentOptions/EtherPaymentOptions';
import CheckoutCardExternal from './CheckoutCardExternal.vue';
import { FormattableNumber } from '@nimiq/utils';

export default class CheckoutCardEthereum
    extends CheckoutCardExternal<ParsedEtherDirectPaymentOptions> {
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
        const paymentOptions = this.paymentOptions;
        const protocolSpecific = paymentOptions.protocolSpecific;
        const paymentDetails = [ ...super.manualPaymentDetails, {
            label: this.$t('Amount') as string,
            value: {
                ETH: paymentOptions.baseUnitAmount,
            },
        }];
        if (protocolSpecific.gasPrice) {
            paymentDetails.push({
                label: this.$t('Gas Price') as string,
                value: {
                    GWEI: new FormattableNumber(protocolSpecific.gasPrice)
                        .moveDecimalSeparator(-9).toString({ maxDecimals: 2 }),
                    ETH: new FormattableNumber(protocolSpecific.gasPrice)
                        .moveDecimalSeparator(-paymentOptions.decimals).toString(),
                },
            });
        }
        if (protocolSpecific.gasLimit) {
            paymentDetails.push({
                label: this.$t('Gas Limit') as string,
                value: protocolSpecific.gasLimit,
            });
        }
        return paymentDetails;
    }
}
</script>
