<template>
    <div class="container">
        <Carousel
            :entries="request.paymentOptions.map((paymentOptions) => paymentOptions.currency)"
            :animationDuration="500"
            :selected="selectedCurrency"
            :disabled="choosenCurrency !== null || availableCurrencies.length === 0"
            @select="selectedCurrency = $event">
            <template v-for="paymentOptions of request.paymentOptions" v-slot:[paymentOptions.currency]>
                <NimiqCheckoutOption
                    v-if="paymentOptions.currency === Currency.NIM"
                    :paymentOptions="paymentOptions"
                    :key="paymentOptions.currency"
                    :class="{confirmed: choosenCurrency === paymentOptions.currency}"
                    @chosen="chooseCurrency"
                    @expired="expired"/>
                <EthereumCheckoutOption
                    v-else-if="paymentOptions.currency === Currency.ETH"
                    :paymentOptions="paymentOptions"
                    :key="paymentOptions.currency"
                    :class="{confirmed: choosenCurrency === paymentOptions.currency}"
                    @chosen="chooseCurrency"
                    @expired="expired"/>
                <BitcoinCheckoutOption
                    v-else-if="paymentOptions.currency === Currency.BTC"
                    :paymentOptions="paymentOptions"
                    :key="paymentOptions.currency"
                    :class="{confirmed: choosenCurrency === paymentOptions.currency}"
                    @chosen="chooseCurrency"
                    @expired="expired"/>
            </template>
        </Carousel>

        <button class="global-close nq-button-s" @click="close">
            <ArrowLeftSmallIcon/>
            Cancel Payment
        </button>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { Carousel, ArrowLeftSmallIcon } from '@nimiq/vue-components';
import { ParsedCheckoutRequest } from '../lib/RequestTypes';
import BitcoinCheckoutOption from '../components/BitcoinCheckoutOption.vue';
import EthereumCheckoutOption from '../components/EthereumCheckoutOption.vue';
import NimiqCheckoutOption from '../components/NimiqCheckoutOption.vue';
import { Currency } from '../lib/PublicRequestTypes';
import { State as RpcState } from '@nimiq/rpc';
import { Static } from '../lib/StaticStore';
import { ERROR_CANCELED } from '../lib/Constants';

@Component({components: {
    ArrowLeftSmallIcon,
    Carousel,
    BitcoinCheckoutOption,
    EthereumCheckoutOption,
    NimiqCheckoutOption,
}})
export default class Checkout extends Vue {

    @Static private rpcState!: RpcState;
    @Static private request!: ParsedCheckoutRequest;
    private choosenCurrency: Currency | null = null;
    private selectedCurrency: Currency = Currency.NIM;
    private availableCurrencies: Currency[] = [];

    private async created() {
        const $subtitle = document.querySelector('.logo .logo-subtitle')!;
        $subtitle.textContent = 'Checkout';
        this.availableCurrencies = this.request.paymentOptions.map((option) => option.currency);
    }

    private close() {
        this.$rpc.reject(new Error(ERROR_CANCELED));
    }

    private chooseCurrency(currency: Currency) {
        this.selectedCurrency = currency;
        this.choosenCurrency = currency;
    }

    private expired(currency: Currency) {
        this.availableCurrencies.splice(this.availableCurrencies.indexOf(currency), 1);
    }

    private data() {
        return {
            Currency,
        };
    }
}
</script>

<style scoped>
    .container >>> .small-page {
        position: relative;
    }

    .container >>> .nq-h1 {
        margin-top: 3.5rem;
        margin-bottom: 1rem;
        line-height: 1;
        text-align: center;
    }

    .carousel >>> .currency-info {
        display: flex;
        flex-direction: column;
        align-items: center;
        transition: transform 0.5s cubic-bezier(.67,0,.16,1);
        transform: translateY(0rem);
    }
    .carousel > :not(.selected) >>> .currency-info {
        transform: translateY(-6rem);
    }

    .carousel {
        width: 100%;
        box-sizing: border-box;
        padding: 0;
        overflow: hidden;
    }

    .carousel >>> .payment-option {
        transition: filter .5s ease;
        padding: 4rem 0;
    }

    .carousel :not(.selected) >>> .payment-option {
        -webkit-filter: grayscale(100%); /* Safari 6.0 - 9.0 */
        filter: grayscale(100%);
    }
</style>

