<template>
    <div class="currency-info">
        <h1 class="nq-h1">
            <span v-if="currency === Currency.NIM" class="nq-icon nimiq-logo"></span>
            <img v-else-if="currencyIcon" :src="currencyIcon"/>
            {{currency}}
        </h1>
        <p class="nq-text">{{ fiatFeeAmount === 0
            ? 'No Fee'
            : isAlmostFree
                ? `~0 ${fiatCurrency.code} Fee`
                : `~${fiatFeeAmount.toFixed(fiatCurrency.digits)} ${fiatCurrency.code} Fee`
        }}</p>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Prop } from 'vue-property-decorator';
import { Currency } from '../lib/PublicRequestTypes';
import { CurrencyCodeRecord } from 'currency-codes';

@Component
export default class CurrencyInfo extends Vue {
    @Prop(String) private currency!: Currency;
    @Prop(String) private currencyIcon?: string;
    @Prop(Object) private fiatCurrency!: CurrencyCodeRecord;
    @Prop(Number) private fiatFeeAmount!: number;

    private data() {
        return {
            Currency,
        };
    }

    private get isAlmostFree() {
        return this.fiatFeeAmount !== 0 && Math.round(this.fiatFeeAmount * 10 ** this.fiatCurrency.digits) === 0;
    }
}
</script>

<style scoped>
    .currency-info h1 {
        display: flex;
        align-items: center;
        margin-bottom: 0 !important;
        padding-bottom: 1.5rem; /* use padding instead of rem to make gap clickable */
        text-transform: uppercase;
        font-size: 3.375rem;
    }

    .currency-info img,
    .currency-info .nq-icon {
        height: 4.5rem;
        margin-right: 2rem;
    }

    .currency-info .nq-icon {
        width: 4.5rem;
    }

    .currency-info p {
        margin-top: 0;
        margin-bottom: 3.375rem;
        font-size: 2.5rem;
    }
</style>
