<template>
    <div class="currency-info">
        <h1 class="nq-h1">
            <span v-if="currency === Currency.NIM" class="nq-icon nimiq-logo"></span>
            <img v-else-if="currencyIcon" :src="currencyIcon"/>
            {{currency}}
        </h1>
        <p class="nq-text">
            <FiatAmount :amount="fiatFeeAmount" :currency="fiatCurrency" />
            Fee
        </p>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Prop } from 'vue-property-decorator';
import { FiatAmount } from '@nimiq/vue-components';
import { Currency } from '../lib/PublicRequestTypes';

@Component({components: {FiatAmount}})
export default class CurrencyInfo extends Vue {
    @Prop(String) private currency!: Currency;
    @Prop(String) private currencyIcon?: string;
    @Prop(String) private fiatCurrency!: string;
    @Prop(Number) private fiatFeeAmount!: number;

    private data() {
        return {
            Currency,
        };
    }
}
</script>

<style scoped>
    .currency-info h1 {
        display: flex;
        align-items: center;
        margin-bottom: 0;
        text-transform: uppercase;
    }

    .currency-info img,
    .currency-info .nq-icon {
        width: 4.5rem;
        height: 4.5rem;
        margin-right: 2rem;
    }
</style>
