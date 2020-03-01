<template>
    <div class="container">
        <div class="spacer"></div>
        <Carousel
            :class="{
                ios: isIOS,
                'offset-currency-info-on-disabled': request.paymentOptions.length > 1,
            }"
            :entries="request.paymentOptions.map((paymentOptions) => paymentOptions.currency)"
            :animationDuration="500"
            :selected="selectedCurrency"
            :disabled="choosenCurrency !== null || availableCurrencies.length === 0"
            @select="selectedCurrency = $event">
            <template v-for="paymentOptions of request.paymentOptions" v-slot:[paymentOptions.currency]>
                <NimiqCheckoutCard
                    v-if="paymentOptions.currency === constructor.Currency.NIM"
                    :paymentOptions="paymentOptions"
                    :key="paymentOptions.currency"
                    :class="{
                        confirmed: choosenCurrency === paymentOptions.currency,
                        left: leftCard === constructor.Currency.NIM,
                        right: rightCard === constructor.Currency.NIM
                    }"
                    @chosen="chooseCurrency"
                    @expired="expired"/>
                <EthereumCheckoutCard
                    v-else-if="paymentOptions.currency === constructor.Currency.ETH"
                    :paymentOptions="paymentOptions"
                    :key="paymentOptions.currency"
                    :class="{
                        confirmed: choosenCurrency === paymentOptions.currency,
                        left: leftCard === constructor.Currency.ETH,
                        right: rightCard === constructor.Currency.ETH
                    }"
                    @chosen="chooseCurrency"
                    @expired="expired"/>
                <BitcoinCheckoutCard
                    v-else-if="paymentOptions.currency === constructor.Currency.BTC"
                    :paymentOptions="paymentOptions"
                    :key="paymentOptions.currency"
                    :class="{
                        confirmed: choosenCurrency === paymentOptions.currency,
                        left: leftCard === constructor.Currency.BTC,
                        right: rightCard === constructor.Currency.BTC
                    }"
                    @chosen="chooseCurrency"
                    @expired="expired"/>
            </template>
        </Carousel>

        <button class="global-close nq-button-s" @click="close">
            <ArrowLeftSmallIcon/>
            Cancel <span>Payment</span>
        </button>
        <div class="spacer"></div>

        <transition name="transition-disclaimer">
            <component :is="screenFitsDisclaimer ? 'div' : 'BottomOverlay'"
                v-if="screenFitsDisclaimer || !disclaimerOverlayClosed"
                class="disclaimer"
                @close="_closeDisclaimerOverlay"
            >
                <strong>Disclaimer</strong>
                This Nimiq interface is non-custodial and solely used to bridge the customer with the merchant directly
                (P2P). Payment and order fulfillment are sole responsibility of the customer and merchant respectively.
            </component>
        </transition>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Watch } from 'vue-property-decorator';
import { BottomOverlay, Carousel, ArrowLeftSmallIcon } from '@nimiq/vue-components';
import { BrowserDetection } from '@nimiq/utils';
import { ParsedCheckoutRequest } from '../lib/RequestTypes';
import BitcoinCheckoutCard from '../components/BitcoinCheckoutCard.vue';
import EthereumCheckoutCard from '../components/EthereumCheckoutCard.vue';
import NimiqCheckoutCard from '../components/NimiqCheckoutCard.vue';
import { Currency as PublicCurrency } from '../lib/PublicRequestTypes';
import { State as RpcState } from '@nimiq/rpc';
import { Static } from '../lib/StaticStore';
import { ERROR_CANCELED } from '../lib/Constants';

@Component({components: {
    ArrowLeftSmallIcon,
    BottomOverlay,
    Carousel,
    BitcoinCheckoutCard,
    EthereumCheckoutCard,
    NimiqCheckoutCard,
}})
class Checkout extends Vue {
    private static DISCLAIMER_CLOSED_COOKIE = 'checkout-disclaimer-closed';

    @Static private rpcState!: RpcState;
    @Static private request!: ParsedCheckoutRequest;
    private choosenCurrency: PublicCurrency | null = null;
    private selectedCurrency: PublicCurrency = PublicCurrency.NIM;
    private leftCard: PublicCurrency | null = null;
    private rightCard: PublicCurrency | null = null;
    private availableCurrencies: PublicCurrency[] = [];
    private readonly isIOS: boolean = BrowserDetection.isIOS();
    private disclaimerOverlayClosed: boolean = false;
    private screenFitsDisclaimer: boolean = true;

    @Watch('selectedCurrency', { immediate: true })
    private updateUnselected() {
        const entries = this.request.paymentOptions.map((paymentOptions) => paymentOptions.currency);
        if (entries.length === 1) return;

        const indexSelected = entries.indexOf(this.selectedCurrency);
        if (entries.length === 2) {
            // We have two cards. Determine whether the non selected is to the left or to the right.
            this.leftCard = indexSelected === 1 ? entries[0] : null;
            this.rightCard = indexSelected === 1 ? null : entries[1];
        } else {
            this.leftCard = entries[(indexSelected - 1 + entries.length) % entries.length];
            this.rightCard = entries[(indexSelected + 1) % entries.length];
        }
    }

    private async created() {
        const $subtitle = document.querySelector('.logo .logo-subtitle')!;
        $subtitle.textContent = 'Checkout';
        this.availableCurrencies = this.request.paymentOptions.map((option) => option.currency);
        document.title = 'Nimiq Checkout';
        this.disclaimerOverlayClosed = new RegExp(`(^| )${Checkout.DISCLAIMER_CLOSED_COOKIE}=`).test(document.cookie);

        this._onResize = this._onResize.bind(this);
        window.addEventListener('resize', this._onResize);
        this._onResize();
    }

    private destroyed() {
        window.removeEventListener('resize', this._onResize);
    }

    private close() {
        this.$rpc.reject(new Error(ERROR_CANCELED));
    }

    private chooseCurrency(currency: PublicCurrency) {
        this.selectedCurrency = currency;
        this.choosenCurrency = currency;
    }

    private expired(currency: PublicCurrency) {
        this.availableCurrencies.splice(this.availableCurrencies.indexOf(currency), 1);
    }

    private _closeDisclaimerOverlay() {
        this.disclaimerOverlayClosed = true;
        // store a session cookie for current domain and path
        document.cookie = `${Checkout.DISCLAIMER_CLOSED_COOKIE}=`;
    }

    private _onResize() {
        const minWidth = 675; // Width below which disclaimer would break into three lines.
        const minHeight = 890; // Height at which two lines fit at bottom, also if logos over carousel shown.
        this.screenFitsDisclaimer = window.innerWidth >= minWidth && window.innerHeight >= minHeight;
    }
}

namespace Checkout {
    export const Currency = PublicCurrency;
}

export default Checkout;
</script>

<style scoped>
    .container {
        margin-top: -2rem; /* to get a bit more space for the long checkout page */
    }

    .container .spacer {
        flex-grow: 1; /* spacer for content distribution instead of margin which is used for disabled carousel offset */
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
        transition: margin-top 1s var(--nimiq-ease);
    }

    .carousel.disabled.offset-currency-info-on-disabled {
        margin-top: -16.125rem; /* currency-info height */
    }

    .carousel >>> .payment-option:not(.confirmed) .nq-card {
        transition: transform .5s var(--nimiq-ease);
    }
    .carousel >>> > :not(.selected) .left .nq-card {
        transform: translateX(8rem);
    }

    .carousel >>> > :not(.selected) .right .nq-card {
        transform: translateX(-8rem);
    }

    .carousel >>> .payment-option {
        padding-bottom: 4rem;
    }

    .carousel >>> .currency-info {
        display: flex;
        flex-direction: column;
        align-items: center;

        --currency-info-translate-y: -8.75rem;
        transition:
            transform .5s cubic-bezier(.67,0,.16,1),
            opacity .25s var(--nimiq-ease);
        transform: scale(1) translateY(0);
    }

    .carousel >>> > :not(.selected) .currency-info {
        transform: scale(1) translateY(var(--currency-info-translate-y));
    }

    .carousel.disabled >>> .currency-info {
        opacity: 0;
    }

    /* Mobile Layout */
    @media (max-width: 500px) {
        .carousel >>> * {
            -webkit-tap-highlight-color: transparent;
        }

        .carousel >>> .payment-option {
            padding: 0;
        }

        .carousel >>> .currency-info {
            --currency-info-mobile-scale: .8;
            transform:
                scale(var(--currency-info-mobile-scale))
                translateY(calc(var(--currency-info-translate-y) / -5));
        }

        .carousel >>> > :not(.selected) .currency-info {
            transform:
                scale(var(--currency-info-mobile-scale))
                translateY(var(--currency-info-translate-y));
        }

        .carousel >>> > :not(.selected) .left .currency-info {
            transform:
                scale(var(--currency-info-mobile-scale))
                translateY(var(--currency-info-translate-y))
                translateX(8rem);
        }

        .carousel >>> > :not(.selected) .right .currency-info {
            transform:
                scale(var(--currency-info-mobile-scale))
                translateY(var(--currency-info-translate-y))
                translateX(-8rem);
        }

        .carousel >>> .confirmed .nq-card {
            /* 56px for mobile browser address bar */
            /* 7.5rem for Nimiq logo & cancel button */
            --iosBottomBar: 0px;
            height: calc(100vh - 7.5rem - 56px - var(--iosBottomBar));
            min-height: 71rem;
        }

        .carousel >>> .currency-info .nq-h1 {
            margin-top: 0;
        }

        /* IOS specific */
        .carousel.ios >>> .confirmed .nq-card {
            --iosBottomBar: 74px;
        }
    }

    @media (max-width: 450px) {
        .carousel >>> .nq-card {
            width: 100vw;
            max-width: none;
            margin: 0;
        }

        .carousel >>> .currency-info {
            --currency-info-translate-y: calc(-100vw / 7.2);
        }
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

    .carousel >>> > :not(.selected) .payment-option:not(.confirmed) .amounts {
        transition: border-top-color .5s var(--nimiq-ease);
        border-top-color: var(--nimiq-card-bg);
    }

    .carousel >>> > :not(.selected) .payment-option:not(.confirmed) .nq-button {
        transition: box-shadow .5s var(--nimiq-ease);
        box-shadow: none;
    }

    .carousel >>> > :not(.selected) .payment-option:not(.confirmed) .arrow-runway {
        transition: opacity .5s var(--nimiq-ease);
        opacity: 0;
    }

    .carousel >>> > :not(.selected) .payment-option:not(.confirmed) .arrow-runway * {
        animation: unset; /* disable animation in background to avoid unnecessary rendering layers */
    }

    .carousel >>> .payment-option:not(.confirmed) video {
        transition: opacity .5s var(--nimiq-ease);
    }

    .carousel >>> > :not(.selected) .payment-option:not(.confirmed) video {
        opacity: 0;
    }

    .global-close {
        margin-top: 1rem;
    }

    .disclaimer {
        width: calc(100% - 3rem);
        transition: opacity .3s var(--nimiq-ease), max-height .3s var(--nimiq-ease);
    }

    .disclaimer:not(.bottom-overlay) {
        margin-bottom: 1rem;
        color: #1f234859; /* nimiq-blue with .35 opacity */
        font-size: 1.5rem;
        line-height: 1.3;
        font-weight: 600;
        text-align: center;
        overflow: hidden;
    }

    .disclaimer.transition-disclaimer-enter,
    .disclaimer.transition-disclaimer-leave-to {
        opacity: 0;
    }

    .disclaimer:not(.bottom-overlay).transition-disclaimer-enter,
    .disclaimer:not(.bottom-overlay).transition-disclaimer-leave-to {
        max-height: 0;
    }

    .disclaimer:not(.bottom-overlay).transition-disclaimer-enter-to,
    .disclaimer:not(.bottom-overlay).transition-disclaimer-leave {
        max-height: 3.75rem; /* height of 2 lines of disclaimer */
    }

    .disclaimer > strong {
        font-weight: bold;
        line-height: 1;
        letter-spacing: .1rem;
        text-transform: uppercase;
    }

    .disclaimer.bottom-overlay > strong {
        font-size: 1.75rem;
        letter-spacing: .125rem;
        opacity: .5;
    }

    @media (max-width: 1300px) {
        .disclaimer:not(.bottom-overlay) {
            max-width: 92rem; /* break disclaimer into 2 lines about equal in length */
            margin-bottom: 1.5rem;
        }
    }
</style>
