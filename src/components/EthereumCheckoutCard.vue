<script lang="ts">
import { createEthereumRequestLink } from '@nimiq/utils';
import { ParsedEtherDirectPaymentOptions } from '../lib/paymentOptions/EtherPaymentOptions';
import NonNimiqCheckoutCard from './NonNimiqCheckoutCard.vue';
import { FormattableNumber } from '@nimiq/utils';

export default class EtherCheckoutCard
    extends NonNimiqCheckoutCard<ParsedEtherDirectPaymentOptions> {
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
            label: this.$t('Amount') as string,
            value: {
                ETH: new FormattableNumber(this.paymentOptions.amount)
                    .moveDecimalSeparator(-this.paymentOptions.decimals).toString(),
            },
        }];
        if (this.paymentOptions.protocolSpecific.gasPrice) {
            paymentDetails.push({
                label: this.$t('Gas Price') as string,
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
                label: this.$t('Gas Limit') as string,
                value: this.paymentOptions.protocolSpecific.gasLimit,
            });
        }
        return paymentDetails;
    }
}
</script>
