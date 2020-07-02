<script lang="ts">
import { createBitcoinRequestLink } from '@nimiq/utils';
import staticStore from '../lib/StaticStore';
import { ParsedBitcoinDirectPaymentOptions } from '../lib/paymentOptions/BitcoinPaymentOptions';
import NonNimiqCheckoutCard from './NonNimiqCheckoutCard.vue';
import { FormattableNumber } from '@nimiq/utils';

export default class BitcoinCheckoutCard
    extends NonNimiqCheckoutCard<ParsedBitcoinDirectPaymentOptions> {
    protected currencyFullName = 'Bitcoin';
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

    protected get manualPaymentDetails() {
        const paymentDetails = [ ...super.manualPaymentDetails, {
            label: this.$t('Amount') as string,
            value: {
                mBTC: new FormattableNumber(this.paymentOptions.amount)
                    .moveDecimalSeparator(-this.paymentOptions.decimals + 3).toString(),
                BTC: new FormattableNumber(this.paymentOptions.amount)
                    .moveDecimalSeparator(-this.paymentOptions.decimals).toString(),
            },
        }];
        if (this.paymentOptions.protocolSpecific.feePerByte || this.paymentOptions.protocolSpecific.fee) {
            const fees: { [key: string]: string | number } = {};
            if (this.paymentOptions.protocolSpecific.feePerByte) {
                fees['SAT/BYTE'] = Math.ceil(this.paymentOptions.protocolSpecific.feePerByte * 100) / 100; // rounded
            }
            if (this.paymentOptions.protocolSpecific.fee) {
                fees.BTC = new FormattableNumber(this.paymentOptions.protocolSpecific.fee)
                    .moveDecimalSeparator(-this.paymentOptions.decimals).toString();
            }
            paymentDetails.push({
                label: this.$t('Fee') as string,
                value: fees,
            });
        }
        return paymentDetails;
    }
}
</script>
