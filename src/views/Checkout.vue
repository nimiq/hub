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
        document.title = 'Nimiq Checkout';
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

    .carousel >>> > :not(.selected) .payment-option {
        -webkit-filter: grayscale(100%); /* Safari 6.0 - 9.0 */
        filter: grayscale(100%);
    }

    .carousel >>> .currency-info {
        display: flex;
        flex-direction: column;
        align-items: center;
        transition: transform .5s cubic-bezier(.67,0,.16,1), opacity .25s var(--nimiq-ease);
        transform: translateY(0rem);
    }

    .carousel >>> > :not(.selected) .currency-info {
        transform: translateY(-7.875rem);
    }

    .carousel.disabled >>> > :not(.selected) .currency-info {
        opacity: 0;
    }

    /* make empty padding in cards click through to cards behind */
    .carousel >>> > * {
        pointer-events: none;
    }

    .carousel >>> .currency-info > *,
    .carousel >>> .nq-card {
        pointer-events: all !important;
    }

    /* Show placeholders when card is not selected */
    .carousel >>> .payment-option:not(.confirmed) .timer,
    .carousel >>> .payment-option:not(.confirmed) .nq-button,
    .carousel >>> .payment-option:not(.confirmed) .nq-button-s,
    .carousel >>> .payment-option:not(.confirmed) .nq-button-pill,
    .carousel >>> .payment-option:not(.confirmed) .nq-card > .nq-h1,
    .carousel >>> .payment-option:not(.confirmed) .info-line .account,
    .carousel >>> .payment-option:not(.confirmed) .info-line .amounts,
    .carousel >>> .payment-option:not(.confirmed) .nq-card-body .label,
    .carousel >>> .payment-option:not(.confirmed) .nq-card-body .amounts .crypto,
    .carousel >>> .payment-option:not(.confirmed) .nq-card-body .amounts .fee,
    .carousel >>> .payment-option:not(.confirmed) .account-list .amount,
    .carousel >>> .payment-option:not(.confirmed) .nq-card-footer .nq-link,
    .carousel >>> .payment-option:not(.confirmed) .account-selector .wallet-label,
    .carousel >>> .payment-option:not(.confirmed) .nq-card-body .identicon-and-label,
    .carousel >>> .payment-option:not(.confirmed) .account-list .identicon-and-label > *,
    .carousel >>> .payment-option:not(.confirmed) .nq-card .non-sufficient-balance .nq-text {
        position: relative;
    }

    .carousel >>> .payment-option:not(.confirmed) .nq-button::after,
    .carousel >>> .payment-option:not(.confirmed) .nq-button-s::after,
    .carousel >>> .payment-option:not(.confirmed) .nq-button-pill::after {
        transition: all .5s var(--nimiq-ease);
    }

    .carousel >>> .payment-option:not(.confirmed) .timer::after,
    .carousel >>> > :not(.selected) .payment-option:not(.confirmed) .nq-button::after,
    .carousel >>> > :not(.selected) .payment-option:not(.confirmed) .nq-button-s::after,
    .carousel >>> > :not(.selected) .payment-option:not(.confirmed) .nq-button-pill::after,
    .carousel >>> .payment-option:not(.confirmed) .nq-card > .nq-h1::after,
    .carousel >>> .payment-option:not(.confirmed) .info-line .account::after,
    .carousel >>> .payment-option:not(.confirmed) .info-line .amounts::after,
    .carousel >>> .payment-option:not(.confirmed) .nq-card-body .label::after,
    .carousel >>> .payment-option:not(.confirmed) .nq-card-body .amounts .crypto::after,
    .carousel >>> .payment-option:not(.confirmed) .nq-card-body .amounts .fee::after,
    .carousel >>> .payment-option:not(.confirmed) .account-list .amount::after,
    .carousel >>> .payment-option:not(.confirmed) .nq-card-footer .nq-link::after,
    .carousel >>> .payment-option:not(.confirmed) .account-selector .wallet-label::before,
    .carousel >>> .payment-option:not(.confirmed) .nq-card-body .identicon-and-label::after,
    .carousel >>> .payment-option:not(.confirmed) .account-list .identicon-and-label > *::after,
    .carousel >>> .payment-option:not(.confirmed) .nq-card .non-sufficient-balance .nq-text::after {
        --placeholder-size: 100%;
        --placeholder-width: var(--placeholder-size);
        --placeholder-height: var(--placeholder-size);
        content: '';
        position: absolute;
        top: calc((100% - var(--placeholder-height)) / 2);
        left: calc((100% - var(--placeholder-width)) / 2);
        width: var(--placeholder-width);
        height: var(--placeholder-height);
        background-color: #f2f2f4; /* --nimiq-blue 0.06 opacity */
        opacity: 0;
        border: none;
        border-radius: 500px;
        z-index: 2;
        transition: all .5s var(--nimiq-ease);
    }

    .carousel >>> .payment-option:not(.confirmed) .nq-card > .nq-h1::after {
        --placeholder-width: 85%;
    }

    .carousel >>> .payment-option:not(.confirmed) .info-line .amounts::after,
    .carousel >>> .payment-option:not(.confirmed) .info-line .account::after,
    .carousel >>> .payment-option:not(.confirmed) .account-selector .wallet-label::before {
        --placeholder-height: 3.25rem;
        top: initial;
        box-shadow: 0 0 0 1rem var(--nimiq-card-bg);
    }

    .carousel >>> > :not(.selected) .payment-option:not(.confirmed) .nq-button::after,
    .carousel >>> > :not(.selected) .payment-option:not(.confirmed) .nq-button-s::after,
    .carousel >>> > :not(.selected) .payment-option:not(.confirmed) .nq-button-pill::after {
        --placeholder-size: 105%;
    }

    .carousel >>> .payment-option:not(.confirmed) .nq-card-body .identicon-and-label::after {
        --placeholder-size: 21rem;
        top: initial;
        left: initial;
        box-shadow: 0 0 0 4rem var(--nimiq-card-bg);
    }

    .carousel >>> .payment-option:not(.confirmed) .nq-card .non-sufficient-balance .nq-text::after {
        --placeholder-width: 90%;
    }

    .carousel >>> .payment-option:not(.confirmed) .nq-card > .nq-h1::after,
    .carousel >>> .payment-option:not(.confirmed) .nq-card-body .label::after,
    .carousel >>> .payment-option:not(.confirmed) .nq-card-body .amounts .crypto::after,
    .carousel >>> .payment-option:not(.confirmed) .nq-card-footer .nq-link::after,
    .carousel >>> .payment-option:not(.confirmed) .nq-card .non-sufficient-balance .nq-text::after {
        box-shadow: 0 0 0 .6rem var(--nimiq-card-bg);
    }

    .carousel >>> > :not(.selected) .payment-option:not(.confirmed) .timer::after,
    .carousel >>> > :not(.selected) .payment-option:not(.confirmed) .nq-button::after,
    .carousel >>> > :not(.selected) .payment-option:not(.confirmed) .nq-button-s::after,
    .carousel >>> > :not(.selected) .payment-option:not(.confirmed) .nq-button-pill::after,
    .carousel >>> > :not(.selected) .payment-option:not(.confirmed) .nq-card > .nq-h1::after,
    .carousel >>> > :not(.selected) .payment-option:not(.confirmed) .info-line .account::after,
    .carousel >>> > :not(.selected) .payment-option:not(.confirmed) .info-line .amounts::after,
    .carousel >>> > :not(.selected) .payment-option:not(.confirmed) .nq-card-body .label::after,
    .carousel >>> > :not(.selected) .payment-option:not(.confirmed) .account-list .amount::after,
    .carousel >>> > :not(.selected) .payment-option:not(.confirmed) .nq-card-body .amounts .crypto::after,
    .carousel >>> > :not(.selected) .payment-option:not(.confirmed) .nq-card-body .amounts .fee::after,
    .carousel >>> > :not(.selected) .payment-option:not(.confirmed) .nq-card-footer .nq-link::after,
    .carousel >>> > :not(.selected) .payment-option:not(.confirmed) .account-selector .wallet-label::before,
    .carousel >>> > :not(.selected) .payment-option:not(.confirmed) .nq-card-body .identicon-and-label::after,
    .carousel >>> > :not(.selected) .payment-option:not(.confirmed) .account-list .identicon-and-label > *::after,
    .carousel >>> > :not(.selected) .payment-option:not(.confirmed) .nq-card .non-sufficient-balance .nq-text::after {
        opacity: 1;
    }

    .carousel >>> > :not(.selected) .payment-option .amounts {
        transition: border-top-color .5s var(--nimiq-ease);
        border-top-color: var(--nimiq-card-bg);
    }

    .carousel >>> > :not(.selected) .payment-option .nq-button {
        transition: box-shadow .5s var(--nimiq-ease);
        box-shadow: none;
    }

    .carousel >>> > :not(.selected) .payment-option .arrow-runway {
        transition: opacity .5s var(--nimiq-ease);
        opacity: 0;
    }
</style>
