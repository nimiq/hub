<template>
    <SmallPage class="checkout-manual-payment-details nq-blue-bg">
        <PaymentInfoLine v-if="rpcState"
            ref="info"
            theme="inverse"
            :cryptoAmount="{
                amount: paymentOptions.amount,
                currency: paymentOptions.currency,
                decimals: paymentOptions.decimals,
            }"
            :fiatAmount="request.fiatAmount && request.fiatCurrency ? {
                amount: request.fiatAmount,
                currency: request.fiatCurrency,
            } : null"
            :address="paymentOptions.protocolSpecific.recipient"
            :origin="rpcState.origin"
            :shopLogoUrl="request.shopLogoUrl"
            :startTime="request.time"
            :endTime="paymentOptions.expires"
        />
        <PageHeader backArrow @back="$emit(constructor.Events.CLOSE)">
            Send your transaction
        </PageHeader>
        <PageBody>
            <p class="nq-notice warning">
                Don’t close this window until confirmation. <br />
                {{ paymentOptions.feeString }}
            </p>
            <CopyableField
                v-for="entry in paymentDetails"
                :key="entry.label"
                :label="entry.label"
                :value="entry.value"
            />
        </PageBody>
    </SmallPage>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';
import {
    CopyableField,
    SmallPage,
    PageHeader,
    PageBody,
    PaymentInfoLine,
    UniversalAmount,
} from '@nimiq/vue-components';
import { State as RpcState } from '@nimiq/rpc';
import { Static } from '../lib/StaticStore';
import { AvailableParsedPaymentOptions, ParsedCheckoutRequest } from '../lib/RequestTypes';
import CheckoutServerApi from '../lib/CheckoutServerApi';

@Component({ components: {
    CopyableField,
    SmallPage,
    PageHeader,
    PageBody,
    PaymentInfoLine,
    UniversalAmount,
}})
class CheckoutManualPaymentDetails<
    Parsed extends AvailableParsedPaymentOptions,
> extends Vue {
    @Prop({
        type: Array,
        required: true,
        validator: (data: any) => Array.isArray(data) && data.length > 0
            && data.every((entry: any) => typeof entry === 'object' && entry.label
                && (['object', 'string', 'number'].includes(typeof entry.value))),
    })
    public paymentDetails!: Array<{ label: string, value: { label: string, value: string | number | object } }>;

    @Prop({
        type: Object,
        required: true,
    }) public paymentOptions!: Parsed;

    @Static private rpcState!: RpcState;
    @Static private request!: ParsedCheckoutRequest;

    private async mounted() {
        const paymentInfoLine = this.$refs.info as PaymentInfoLine;
        if (!paymentInfoLine) return;

        if (!this.request.callbackUrl || !this.request.csrf) {
            throw new Error('Can\'t fetch time without callbackUrl and csrf token');
        }
        const serverTime = await CheckoutServerApi.fetchTime(this.request.callbackUrl, this.request.csrf);
        paymentInfoLine.setTime(serverTime);
    }
}
namespace CheckoutManualPaymentDetails { // tslint:disable-line:no-namespace
    export enum Events {
        CLOSE = 'close',
    }
}
export default CheckoutManualPaymentDetails;
</script>

<style scoped>
    .page-body {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
    }

    .page-body >>> p {
        flex-basis: 9rem;
        flex-shrink: 1;
    }

    .page-header {
        padding-top: 2rem;
        padding-bottom: 2rem;
    }

    .copyable-field >>> .nq-label {
        margin-top: 2rem;
    }

    .page-header >>> .nq-h1 {
        margin-top: 0 !important;
        margin-bottom: 0 !important;
    }

    .nq-notice {
        margin: 0;
        text-align: center;
    }
</style>
