<script lang="ts">
import { createBitcoinRequestLink } from '@nimiq/utils';
import staticStore from '../lib/StaticStore';
import { ParsedBitcoinDirectPaymentOptions } from '../lib/paymentOptions/BitcoinPaymentOptions';
import CheckoutCardExternal from './CheckoutCardExternal.vue';
import { FormattableNumber } from '@nimiq/utils';

export default class CheckoutCardBitcoin
    extends CheckoutCardExternal<ParsedBitcoinDirectPaymentOptions> {
    protected currencyFullName = 'Bitcoin';
    protected icon = 'icon-btc.svg';

    protected get paymentLink() {
        const paymentOptions = this.paymentOptions;
        const protocolSpecific = paymentOptions.protocolSpecific;
        if (!protocolSpecific.recipient) return '#';
        return createBitcoinRequestLink(protocolSpecific.recipient, {
            amount: paymentOptions.amount,
            fee: protocolSpecific.fee,
            label: staticStore.request
                ? `Crypto-Checkout powered by Nimiq - ${staticStore.request.appName}`
                : undefined,
        });
    }

    protected get manualPaymentDetails() {
        const paymentOptions = this.paymentOptions;
        const protocolSpecific = paymentOptions.protocolSpecific;
        const paymentDetails = [ ...super.manualPaymentDetails, {
            label: this.$t('Amount') as string,
            value: {
                BTC: paymentOptions.baseUnitAmount,
                mBTC: new FormattableNumber(paymentOptions.amount)
                    .moveDecimalSeparator(-paymentOptions.decimals + 3).toString(),
            },
        }];
        if (protocolSpecific.feePerByte || protocolSpecific.fee) {
            const fees: { [key: string]: string | number } = {};
            if (protocolSpecific.feePerByte) {
                fees['Sat/Byte'] = Math.ceil(protocolSpecific.feePerByte * 100) / 100; // rounded
            }
            if (protocolSpecific.fee) {
                fees.BTC = new FormattableNumber(protocolSpecific.fee)
                    .moveDecimalSeparator(-paymentOptions.decimals).toString();
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
