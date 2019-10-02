<template>
    <div class="payment-option" :id="paymentOptions.currency">
        <CurrencyInfo
            :currency="paymentOptions.currency"
            :fiatCurrency="request.fiatCurrency"
            :fiatFeeAmount="paymentOptions.fiatFee(request.fiatAmount, request.fiatCurrency)"
            :currencyIcon="icon"/>

        <SmallPage>
            <StatusScreen
                :title="title"
                :state="state"
                :status="status"
                v-if="showStatusScreen"
                :message="message"
                @main-action="() => this.backToShop()"
                mainAction="Go back to shop"/>
            <PaymentInfoLine v-if="rpcState"
                ref="info"
                :cryptoAmount="{
                    amount: paymentOptions.amount,
                    currency: paymentOptions.currency,
                    digits: paymentOptions.digits,
                }"
                :fiatAmount="request.fiatAmount && request.fiatCurrency ? {
                    amount: request.fiatAmount * 10 ** request.fiatCurrency.digits,
                    currency: request.fiatCurrency.code,
                    digits: request.fiatCurrency.digits,
                } : null"
                :address="paymentOptions.protocolSpecific.recipient"
                :origin="rpcState.origin"
                :shopLogoUrl="request.shopLogoUrl"
                :startTime="request.time"
                :endTime="paymentOptions.expires" />
            <h2 class="nq-h1">
                Pay the amount to the shown address
            </h2>
            <PageBody>
                <div class="qr-code">
                    <QrCodeIcon />
                    <div class="nq-blue">Payment Info will appear after confirmation</div>
                </div>
                <div class="copyable-payment-information">
                    <Copyable :text="paymentOptions.baseUnitAmount">
                        <Amount class="nq-link payment-link"
                            :currency="paymentOptions.currency"
                            :totalDecimals="paymentOptions.digits"
                            :minDecimals="paymentOptions.digits"
                            :maxDecimals="paymentOptions.digits"
                            :amount="paymentOptions.amount"
                        />
                    </Copyable>
                    <Copyable>
                        <a class="nq-link payment-link">{{paymentOptions.protocolSpecific.recipient}}</a>
                    </Copyable>
                </div>
            </PageBody>
            <PageFooter>
                <a v-if="selected" class="nq-button light-blue" :href="paymentOptions.paymentLink">Open wallet</a>
                <button v-else class="nq-button light-blue" @click="selectCurrency">Select {{paymentOptions.currency}}</button>
            </PageFooter>
        </SmallPage>
    </div>
</template>

<script lang="ts">
import { Component } from 'vue-property-decorator';
import { Copyable, PageBody, PageFooter, PaymentInfoLine, QrCodeIcon, SmallPage, Amount } from '@nimiq/vue-components';
import QrCode from 'qr-code';
import { AvailablePaymentOptions, Currency } from '../lib/PublicRequestTypes';
import { AvailableParsedPaymentOptions } from '../lib/RequestTypes';
import CheckoutOption from './CheckoutOption.vue';
import CurrencyInfo from './CurrencyInfo.vue';
import StatusScreen from './StatusScreen.vue';

@Component({components: {
    Copyable,
    CurrencyInfo,
    PageBody,
    PageFooter,
    PaymentInfoLine,
    QrCodeIcon,
    SmallPage,
    StatusScreen,
    Amount,
}})
export default class NonNimiqCheckoutOption<
    Parsed extends AvailableParsedPaymentOptions
> extends CheckoutOption<Parsed> {
    protected selected: boolean = false;

    private checkNetworkInterval: number | null = null;

    public data() {
        return {
            Currency,
        };
    }

    protected mounted() {
        if (this.paymentOptions.expires) {
            this.fetchTime().then((referenceTime) => {
                if (referenceTime) {
                    if (this.$refs.info) {
                        (this.$refs.info as PaymentInfoLine).setTime(referenceTime);
                    }
                    this.setupTimeout(referenceTime);
                }
            });
        }
    }

    protected destroyed() {
        if (this.checkNetworkInterval) clearInterval(this.checkNetworkInterval);
        super.destroyed();
    }

    protected async selectCurrency() {
        if (this.request.callbackUrl) {
            this.showStatusScreen = true;
            await this.fetchPaymentOption();
        }

        let element: HTMLElement | null = document.getElementById(this.paymentOptions.currency!);
        if (element) {
            element = element.querySelector('.qr-code');
        }
        if (!element) {
            throw new Error(`An Element #${this.paymentOptions.currency} .qr-code must exist`);
        }

        this.$emit('chosen', this.paymentOptions.currency);
        this.selected = true;

        QrCode.render({
            text: this.paymentOptions.paymentLink,
            radius: 0.5, // 0.0 to 0.5
            ecLevel: 'M', // L, M, Q, H
            fill: '#1F2348', // foreground color
            background: null, // color or null for transparent
            size: 200, // in pixels
        }, element);

        this.checkNetworkInterval = window.setInterval(async () => {
            const data = new FormData();
            data.append('currency', this.paymentOptions.currency);
            data.append('command', 'check_network');
            const fetchedData = await this.fetchData(data);

            if (fetchedData.transaction_found === true) {
                window.clearInterval(this.checkNetworkInterval!);
                if (this.optionTimeout) {
                    window.clearTimeout(this.optionTimeout);
                }
                return this.showSuccessScreen();
            }
            if (this.timeoutReached) {
                window.clearInterval(this.checkNetworkInterval!);
                this.timedOut();
            }
        }, 10000);
    }

    protected checkBlur() {
        // see if window gets blurred as an indicator for an opened wallet app.
    }

    protected showSuccessScreen() {
        this.title = 'Payment successful';
        this.showStatusScreen = true;
        this.$nextTick(() => this.state = StatusScreen.State.SUCCESS);
        window.setTimeout(() => this.$rpc.resolve({success: true}),  StatusScreen.SUCCESS_REDIRECT_DELAY);
    }
}
</script>

<style scoped>
    .status-screen {
        position: absolute;
        left: 0;
        top: 0;
    }

    .currency-info h1 {
        display: flex;
        align-items: center;
        margin-bottom: 0;
    }

    .currency-info img,
    .currency-info .nq-icon {
        width: 4.5rem;
        height: 4.5rem;
        margin-right: 2rem;
    }

    .payment-option .page-body {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-around;
    }

    .payment-option:not(.confirmed) h2,
    .payment-option:not(.confirmed) a.payment-link.blurred,
    .payment-option:not(.confirmed) .copyable-payment-information {
        filter: blur(1.5rem);
        opacity: .1;
        transition: filte .5s ease, opacity .5s ease;
    }

    .payment-option .page-body .qr-code {
        position: relative;
    }

    .payment-option .page-body >>> .nq-icon {
        width: 25rem;
        height: auto;
        opacity: .1;
        filter: blur(1.5rem);
        transition: opacity .5s ease;
    }

    .payment-option .page-body .qr-code div {
        display: flex;
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        align-items: center;
        justify-content: center;
        text-align: center;
        opacity: .4;
        transition: opacity .5s ease;
    }

    .payment-option .page-body .qr-code >>> canvas {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
    }

    .payment-option.confirmed .page-body >>> .nq-icon,
    .payment-option.confirmed .page-body .qr-code div  {
        opacity: 0;
    }

    .payment-option .page-body .payment-link {
        word-break: break-all;
        text-align: center;
        background: none;
    }

    .payment-option:not(.confirmed) .page-body .payment-link {
        background: var(--nimiq-blue-bg);
        transition: background 5s ease, color 5s ease;
        color: transparent;
        border-radius: 1.5rem;
        width: 100%;
    }

    .copyable-payment-information {
        margin-top: 2rem;
        width: 100%;
    }

    .copyable-payment-information >>> .copyable {
        margin-bottom: 0;
        padding: 1rem;
        width: 100%;
        text-align: center;
        pointer-events: none;
    }

    a.nq-button {
        line-height: 7.5rem;
    }

    /* todo */
    .confirmed .copyable-payment-information >>> .copyable {
        border: 1px solid rgba(31, 35, 72, 0.1);
        pointer-events: all;
    }

    .copyable-payment-information >>> .copyable + .copyable {
        border-top: 0;
    }

    .copyable-payment-information >>> .copyable:first-of-type {
        border-radius: .5rem .5rem 0 0;
    }

    .copyable-payment-information >>> .copyable:last-of-type {
        border-radius: 0 0 .5rem .5rem;
    }

    .copyable-payment-information >>> .copyable:before {
        content: "";
    }

    .copyable-payment-information >>> .copyable.copied:after,
    .copyable-payment-information >>> .copyable:not(.copied):hover:before {
        padding: 0;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 35 40'%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M34.07 6.01L28.95.92c-.6-.59-1.4-.92-2.24-.92H12.33a3.17 3.17 0 0 0-3.16 3.17v5.16h-6A3.17 3.17 0 0 0 0 11.5v25.35A3.17 3.17 0 0 0 3.17 40h19.5a3.17 3.17 0 0 0 3.16-3.16v-5.17h6A3.17 3.17 0 0 0 35 28.5V8.25c0-.84-.33-1.65-.93-2.24zM22.5 35.83c0 .46-.37.84-.83.84H4.17a.83.83 0 0 1-.84-.84V12.5c0-.46.38-.83.84-.83h12.97c.22 0 .43.08.58.23l4.53 4.43c.16.16.25.37.25.6v18.9zm3.75-7.5h4.58c.46 0 .84-.37.84-.83V8.6a.83.83 0 0 0-.25-.6l-4.58-4.47a.83.83 0 0 0-.58-.24l-12.93.04a.83.83 0 0 0-.83.84v3.75c0 .23.19.41.42.41h4.63c.84 0 1.64.33 2.23.93l5.12 5.09c.6.59.93 1.4.93 2.23v11.34c0 .23.19.41.42.41z' fill='currentColor'/%3E%3C/svg%3E");
        left: 1.5rem;
        top: .5rem;
        width: 1.75rem;
        height: 2rem;
    }
</style>
