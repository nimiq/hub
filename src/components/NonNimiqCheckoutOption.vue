<template>
    <div class="payment-option" :id="paymentOptions.currency">
        <CurrencyInfo
            :currency="paymentOptions.currency"
            :fiatCurrency="request.fiatCurrency"
            :fiatFeeAmount="paymentOptions.fiatFee(request.fiatAmount)"
            :currencyIcon="icon"/>

        <SmallPage>
            <transition name="transition-fade">
                <StatusScreen
                    v-if="showStatusScreen"
                    :state="state"
                    :title="title"
                    :status="status"
                    :message="message"
                    @main-action="() => this.backToShop()"
                    mainAction="Go back to shop"
                >
                    <template v-if="timeoutReached" v-slot:warning>
                        <StopwatchIcon class="stopwatch-icon"/>
                        <h1 class="title nq-h1">{{ title }}</h1>
                        <p v-if="message" class="message nq-text">{{ message }}</p>
                    </template>
                </StatusScreen>
            </transition>
            <PaymentInfoLine v-if="rpcState"
                ref="info"
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
                :endTime="paymentOptions.expires" />
            <h2 class="nq-h1" v-if="this.selected">
                Send your transaction
            </h2>
            <PageBody v-if="!this.selected">
                <Account layout="column"
                    :image="request.shopLogoUrl"
                    :label="rpcState.origin.split('://')[1]"/>
                <div class="amounts">
                    <Amount class="crypto nq-light-blue"
                        :currency="paymentOptions.currency"
                        :totalDecimals="paymentOptions.decimals"
                        :minDecimals="0"
                        :maxDecimals="paymentOptions.decimals < 8 ? paymentOptions.decimals : 8"
                        :amount="paymentOptions.amount"
                    />
                    <FiatAmount class="fiat"
                        :currency="request.fiatCurrency"
                        :amount="request.fiatAmount"
                    />
                </div>
            </PageBody>
            <PageBody v-else>
                <div class="qr-code">
                </div>
                <div class="copyable-payment-information">
                    <Copyable :text="paymentOptions.baseUnitAmount">
                        <Amount class="nq-link payment-link"
                            :currency="paymentOptions.currency"
                            :totalDecimals="paymentOptions.decimals"
                            :minDecimals="paymentOptions.decimals"
                            :maxDecimals="paymentOptions.decimals"
                            :amount="paymentOptions.amount"
                        />
                    </Copyable>
                    <Copyable>
                        <a class="nq-link payment-link">{{paymentOptions.protocolSpecific.recipient}}</a>
                    </Copyable>
                </div>
            </PageBody>
            <PageFooter v-if="selected">
                <a class="nq-button light-blue" :href="this.paymentLink">Use app</a>
                <p class="nq-text-s"><AlertTriangleIcon/>Don’t close this window until confirmation</p>
            </PageFooter>
            <PageFooter v-else>
                <button class="nq-button light-blue" @click="selectCurrency">Pay with {{paymentOptions.currency}}</button>
            </PageFooter>
        </SmallPage>
    </div>
</template>

<script lang="ts">
import { Component } from 'vue-property-decorator';
import {
    Account,
    AlertTriangleIcon,
    Copyable,
    PageBody,
    PageFooter,
    PaymentInfoLine,
    SmallPage,
    StopwatchIcon,
    Amount,
    FiatAmount,
} from '@nimiq/vue-components';
import QrCode from 'qr-code';
import { AvailableParsedPaymentOptions } from '../lib/RequestTypes';
import CheckoutOption from './CheckoutOption.vue';
import CurrencyInfo from './CurrencyInfo.vue';
import StatusScreen from './StatusScreen.vue';
import CheckoutServerApi from '../lib/CheckoutServerApi';

@Component({components: {
    Account,
    AlertTriangleIcon,
    Copyable,
    CurrencyInfo,
    PageBody,
    PageFooter,
    PaymentInfoLine,
    SmallPage,
    StatusScreen,
    StopwatchIcon,
    Amount,
    FiatAmount,
}})
export default class NonNimiqCheckoutOption<
    Parsed extends AvailableParsedPaymentOptions
> extends CheckoutOption<Parsed> {
    protected selected: boolean = false;

    private checkNetworkInterval: number | null = null;

    protected mounted() {
        super.mounted();
    }

    protected destroyed() {
        if (this.checkNetworkInterval) clearInterval(this.checkNetworkInterval);
        super.destroyed();
    }

    protected get paymentLink(): string {
        throw new Error('Needs to be implemented by child classes.');
    }

    protected async selectCurrency() {
        this.selected = true;
        if (this.request.callbackUrl) {
            this.showStatusScreen = true;
            try {
                await this.fetchPaymentOption();
            } catch (e) {
                this.$rpc.reject(e);
                return;
            }
        }
        if (!this.paymentOptions.protocolSpecific.recipient) {
            this.$rpc.reject(new Error('Failed to fetch recipient'));
            return;
        }
        let element: HTMLElement | null = document.getElementById(this.paymentOptions.currency!);
        if (element) {
            element = element.querySelector('.qr-code');
        }
        if (!element) {
            throw new Error(`An Element #${this.paymentOptions.currency} .qr-code must exist`);
        }

        this.$emit('chosen', this.paymentOptions.currency);

        this.$nextTick(() =>
                QrCode.render({
                    text: this.paymentLink,
                    radius: 0.5, // 0.0 to 0.5
                    ecLevel: 'M', // L, M, Q, H
                    fill: '#1F2348', // foreground color
                    background: null, // color or null for transparent
                    size: 200, // in pixels
                },
                element!,
            ),
        );

        this.checkNetworkInterval = window.setInterval(async () => {
            if (!this.request.callbackUrl || !this.request.csrf) return;
            let fetchedData;
            try {
                fetchedData = await CheckoutServerApi.getState(this.request.callbackUrl,
                    this.paymentOptions.currency, this.request.csrf);
            } catch (e) {
                return;
            }

            if (fetchedData.payment_accepted === true) {
                window.clearInterval(this.checkNetworkInterval!);
                window.clearTimeout(this.optionTimeout);
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
        transition: opacity .3s var(--nimiq-ease);
    }

    .status-screen .stopwatch-icon {
        font-size: 15.5rem;
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

    .payment-option:not(.confirmed) .info-line >>> .amounts,
    .payment-option:not(.confirmed) .info-line >>> .arrow-runway,
    .payment-option:not(.confirmed) .info-line >>> .description .account {
        opacity: 0;
        transition: opacity .5s ease;
    }

    .payment-option .page-body {
        width: 52.5rem;
        padding-top: 0;
        padding-bottom: 0;
    }

    .payment-option .account >>> .identicon-and-label .identicon {
        width: 21rem;
        height: 21rem;
    }

    .payment-option .account >>> .identicon-and-label .label {
        font-weight: 600;
        font-size: 3.5rem;
        line-height: 3.5rem;
        margin-top: 2.75rem;
        margin-bottom: 3rem;
    }

    .payment-option .amounts {
        display: flex;
        flex-direction: column;
        flex-grow: 1;
        width: 100%;
        align-items: center;
        border-top: 0.125rem solid rgba(31, 35, 72, 0.1); /* based on nq-dark-blue */
    }

    .payment-option .amounts .crypto {
        margin-top: 3.5rem;
        font-weight: 600;
        font-size: 5rem;
        line-height: 5rem;
    }

    .payment-option .amounts .fiat {
        margin-top: 1.75rem;
        font-size: 2rem;
        line-height: 2.75rem;
    }

    .payment-option.confirmed .page-body {
        justify-content: flex-end;
        padding-bottom: 1rem;
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

    .page-footer a.nq-button {
        line-height: 7.5rem;
        margin: 2rem 4.75rem 2rem;
    }

    .page-footer a.nq-button + p.nq-text-s {
        align-self: center;
        color:  rgba(31, 35, 72, 0.5);
        align-content: center;
        margin: 0 0 1rem;
        display: flex;
    }

    .page-footer a.nq-button + p.nq-text-s > svg {
        margin-right: 1rem;
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

    .copyable-payment-information >>> .copyable.copied:after,
    .copyable-payment-information >>> .copyable:before,
    .copyable-payment-information.copied >>> .copyable:before {
        content: "";
    }

    .copyable-payment-information >>> .copyable:hover:before {
        padding: 0;
        opacity: .5;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 35 40'%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M34.07 6.01L28.95.92c-.6-.59-1.4-.92-2.24-.92H12.33a3.17 3.17 0 0 0-3.16 3.17v5.16h-6A3.17 3.17 0 0 0 0 11.5v25.35A3.17 3.17 0 0 0 3.17 40h19.5a3.17 3.17 0 0 0 3.16-3.16v-5.17h6A3.17 3.17 0 0 0 35 28.5V8.25c0-.84-.33-1.65-.93-2.24zM22.5 35.83c0 .46-.37.84-.83.84H4.17a.83.83 0 0 1-.84-.84V12.5c0-.46.38-.83.84-.83h12.97c.22 0 .43.08.58.23l4.53 4.43c.16.16.25.37.25.6v18.9zm3.75-7.5h4.58c.46 0 .84-.37.84-.83V8.6a.83.83 0 0 0-.25-.6l-4.58-4.47a.83.83 0 0 0-.58-.24l-12.93.04a.83.83 0 0 0-.83.84v3.75c0 .23.19.41.42.41h4.63c.84 0 1.64.33 2.23.93l5.12 5.09c.6.59.93 1.4.93 2.23v11.34c0 .23.19.41.42.41z' fill='currentColor'/%3E%3C/svg%3E");
        left: 1.5rem;
        top: calc(50% - 1rem);
        width: 1.75rem;
        height: 2rem;
        transition: ease-out;
    }

    .copyable-payment-information >>> .copyable.copied:before {
        padding: 0;
        opacity: 1;

        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 35 40'%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M34.07 6.01L28.95.92c-.6-.59-1.4-.92-2.24-.92H12.33a3.17 3.17 0 0 0-3.16 3.17v5.16h-6A3.17 3.17 0 0 0 0 11.5v25.35A3.17 3.17 0 0 0 3.17 40h19.5a3.17 3.17 0 0 0 3.16-3.16v-5.17h6A3.17 3.17 0 0 0 35 28.5V8.25c0-.84-.33-1.65-.93-2.24zM22.5 35.83c0 .46-.37.84-.83.84H4.17a.83.83 0 0 1-.84-.84V12.5c0-.46.38-.83.84-.83h12.97c.22 0 .43.08.58.23l4.53 4.43c.16.16.25.37.25.6v18.9zm3.75-7.5h4.58c.46 0 .84-.37.84-.83V8.6a.83.83 0 0 0-.25-.6l-4.58-4.47a.83.83 0 0 0-.58-.24l-12.93.04a.83.83 0 0 0-.83.84v3.75c0 .23.19.41.42.41h4.63c.84 0 1.64.33 2.23.93l5.12 5.09c.6.59.93 1.4.93 2.23v11.34c0 .23.19.41.42.41z' fill='currentColor'/%3E%3C/svg%3E");
        left: 1.5rem;
        top: calc(50% - 1rem);
        width: 1.75rem;
        height: 2rem;
    }
</style>
