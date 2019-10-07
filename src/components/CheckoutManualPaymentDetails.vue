<template>
    <SmallPage class="checkout-manual-payment-details nq-blue-bg">
        <button class="nq-button-s inverse close-button" @click="$emit(constructor.Events.CLOSE)">
            <CloseIcon/>
        </button>
        <p class="nq-notice info">
            Paste the information<br/>below into your<br/>wallet app.
        </p>
        <CopyableField
            v-for="entry in paymentDetails"
            :key="entry.label"
            :label="entry.label"
            :value="entry.value"
        />
    </SmallPage>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';
import { CloseIcon, CopyableField, SmallPage } from '@nimiq/vue-components';

@Component({components: {CloseIcon, CopyableField, SmallPage}})
class CheckoutManualPaymentDetails extends Vue {
    @Prop({
        type: Array,
        required: true,
        validator: (data: any) => Array.isArray(data) && data.length > 0
            && data.every((entry: any) => typeof entry === 'object' && entry.label
                && (['object', 'string', 'number'].includes(typeof entry.value))),
    })
    public paymentDetails!: Array<{ label: string, value: { label: string, value: string | number | object } }>;
}
namespace CheckoutManualPaymentDetails { // tslint:disable-line:no-namespace
    export enum Events {
        CLOSE = 'close',
    }
}
export default CheckoutManualPaymentDetails;
</script>

<style scoped>
    .small-page {
        padding: 4rem;
    }

    .close-button {
        align-self: flex-end;
        font-size: 3rem;
        line-height: 0;
        padding: 0;
        height: unset;
        color: white;
        background: transparent !important;
    }

    .close-button .nq-icon {
        opacity: .2;
        transition: opacity .3s var(--nimiq-ease);
    }

    .close-button:hover .nq-icon,
    .close-button:focus .nq-icon,
    .close-button:active .nq-icon {
        opacity: .4;
    }

    .nq-notice {
        margin: auto;
        font-size: 2.5rem;
        text-align: center;
    }
</style>
