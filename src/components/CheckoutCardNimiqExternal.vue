<script lang="ts">
import { createNimiqRequestLink, FormattableNumber, NimiqRequestLinkType, Utf8Tools } from '@nimiq/utils';
import staticStore from '../lib/StaticStore';
import { ParsedNimiqDirectPaymentOptions } from '../lib/paymentOptions/NimiqPaymentOptions';
import CheckoutCardExternal from './CheckoutCardExternal.vue';

export default class CheckoutCardNimiqExternal
    extends CheckoutCardExternal<ParsedNimiqDirectPaymentOptions> {
    protected currencyFullName = 'Nimiq';
    protected icon = ''; // CurrencyInfo uses css class nimiq-logo instead

    protected get paymentLink() {
        const paymentOptions = this.paymentOptions;
        const protocolSpecific = paymentOptions.protocolSpecific;
        if (!protocolSpecific.recipient) return '#';
        return createNimiqRequestLink(protocolSpecific.recipient.toUserFriendlyAddress(), {
            amount: paymentOptions.amount,
            message: protocolSpecific.extraData && Utf8Tools.isValidUtf8(protocolSpecific.extraData)
                ? Utf8Tools.utf8ByteArrayToString(protocolSpecific.extraData)
                : undefined,
            label: staticStore.request ? `Nimiq Checkout - ${staticStore.request.appName}` : undefined,
            type: NimiqRequestLinkType.URI,
        });
    }

    protected get manualPaymentDetails() {
        const paymentOptions = this.paymentOptions;
        const protocolSpecific = paymentOptions.protocolSpecific;
        const paymentDetails = [ ...super.manualPaymentDetails, {
            label: this.$t('Amount') as string,
            value: {
                NIM: paymentOptions.baseUnitAmount,
            },
        }];
        if (protocolSpecific.feePerByte || protocolSpecific.fee) {
            const fees: { [key: string]: string | number } = {};
            if (protocolSpecific.fee) {
                fees.NIM = new FormattableNumber(protocolSpecific.fee)
                    .moveDecimalSeparator(-paymentOptions.decimals).toString();
            }
            if (protocolSpecific.feePerByte) {
                fees['Luna/Byte'] = Math.ceil(protocolSpecific.feePerByte * 100) / 100; // rounded
            }
            paymentDetails.push({
                label: this.$t('Fee') as string,
                value: fees,
            });
        }
        if (protocolSpecific.extraData && protocolSpecific.extraData.byteLength
            && Utf8Tools.isValidUtf8(protocolSpecific.extraData)) {
            paymentDetails.push({
                label: this.$t('Message / Payment Reference') as string,
                value: Utf8Tools.utf8ByteArrayToString(protocolSpecific.extraData),
            });
        }

        return paymentDetails;
    }
}
</script>
