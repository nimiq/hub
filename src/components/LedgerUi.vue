<template>
    <div class="ledger-ui" :class="{ small }">
        <StatusScreen :state="'loading'" :title="instructionsTitle" :status="instructionsText" :small="small">
            <template slot="loading">
                <transition name="transition-fade">
                    <LoadingSpinner v-if="illustration === constructor.Illustrations.LOADING"/>
                </transition>
                <transition name="transition-fade">
                    <div v-if="illustration !== constructor.Illustrations.LOADING" class="ledger-device-container"
                        :illustration="illustration">
                        <div class="ledger-screen-confirm-address ledger-screen"></div>
                        <div class="ledger-screen-confirm-transaction ledger-screen"></div>
                        <div class="ledger-screen-app ledger-screen"></div>
                        <div class="ledger-screen-home ledger-screen"></div>
                        <div class="ledger-screen-pin ledger-screen">
                            <div class="ledger-pin-dot"></div>
                            <div class="ledger-pin-dot"></div>
                            <div class="ledger-pin-dot"></div>
                            <div class="ledger-pin-dot"></div>
                            <div class="ledger-pin-dot"></div>
                            <div class="ledger-pin-dot"></div>
                            <div class="ledger-pin-dot"></div>
                            <div class="ledger-pin-dot"></div>
                        </div>
                        <div class="ledger-opacity-container">
                            <div class="ledger-cable"></div>
                            <div class="ledger-device"></div>
                        </div>
                    </div>
                </transition>
            </template>
        </StatusScreen>
    </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';
import { LoadingSpinner } from '@nimiq/vue-components';
import LedgerApi from '@/lib/LedgerApi';
import StatusScreen from '@/components/StatusScreen.vue';

@Component({ components: { StatusScreen, LoadingSpinner } })
class LedgerUi extends Vue {
    private static CONNECT_ANIMATION_STEP_DURATION = 9000 / 3;

    @Prop(Boolean) public small?: boolean;

    private state: LedgerApi.State = LedgerApi.currentState;
    private instructionsTitle: string = '';
    private instructionsText: string = '';
    private connectTimer: number = -1;
    private connectInstructionsTextInterval: number = -1;
    private loadingFailed: boolean = false;

    private created() {
        this._onStateChange = this._onStateChange.bind(this);
        LedgerApi.on(LedgerApi.EventType.STATE_CHANGE, this._onStateChange);
        this._onStateChange(LedgerApi.currentState);
    }

    private destroyed() {
        LedgerApi.off(LedgerApi.EventType.STATE_CHANGE, this._onStateChange);
    }

    private _onStateChange(state: LedgerApi.State) {
        if (state.type === LedgerApi.StateType.CONNECTING) {
            // if connecting, only switch to connecting state if connecting takes some time
            this._onStateConnecting();
            return;
        }
        clearTimeout(this.connectTimer);
        clearInterval(this.connectInstructionsTextInterval);
        this.connectTimer = -1;
        this.connectInstructionsTextInterval = -1;

        this.state = state;
        switch (state.type) {
            case LedgerApi.StateType.IDLE:
                this._showInstructions(null);
                break;
            case LedgerApi.StateType.LOADING:
                this._onStateLoading();
                break;
            case LedgerApi.StateType.REQUEST_PROCESSING:
                this._onRequest(state);
                break;
            case LedgerApi.StateType.REQUEST_CANCELLING:
                this._showInstructions('', 'Please cancel the request on your Ledger');
                break;
            case LedgerApi.StateType.ERROR:
                this._onError(state);
                break;
        }
    }

    private _onStateLoading() {
        const retryMessage = this.loadingFailed ? 'Loading failed, retrying...' : '';
        this._showInstructions('', retryMessage);
    }

    private _onStateConnecting() {
        this.loadingFailed = false;
        // if ledger is already connected via USB and unlocked, establishing the API connection
        // usually takes < 500ms. Only if connecting takes longer, we show the connect instructions
        if (this.connectTimer !== -1) return;
        this.connectTimer = window.setTimeout(() => {
            this.connectTimer = -1;
            if (LedgerApi.currentState.type !== LedgerApi.StateType.CONNECTING) return;
            this.state = LedgerApi.currentState;
            this._cycleConnectInstructions();
            this.connectInstructionsTextInterval =
                window.setInterval(() => this._cycleConnectInstructions(), LedgerUi.CONNECT_ANIMATION_STEP_DURATION);
        }, 550);
    }

    private _onRequest(state: LedgerApi.State) {
        const request = state.request!;
        switch (request.type) {
            case LedgerApi.RequestType.GET_WALLET_ID:
            case LedgerApi.RequestType.GET_PUBLIC_KEY:
            case LedgerApi.RequestType.GET_ADDRESS:
                // no instructions needed as not interactive
                break;
            case LedgerApi.RequestType.DERIVE_ACCOUNTS:
                // not interactive, but takes ~6 seconds
                this._showInstructions('Fetching Addresses');
                break;
            case LedgerApi.RequestType.CONFIRM_ADDRESS:
                this._showInstructions('Confirm Address',
                    `Confirm that the address on your Ledger matches ${request.params.addressToConfirm!}`);
                break;
            case LedgerApi.RequestType.SIGN_TRANSACTION:
                this._showInstructions('Confirm Transaction',
                    'Confirm using your Ledger');
                break;
            default:
                throw new Error(`Unhandled request: ${request.type}`);
        }
    }

    private _onError(state: LedgerApi.State) {
        const error = state.error!;
        switch (error.type) {
            case LedgerApi.ErrorType.LEDGER_BUSY:
                this._showInstructions('', 'Please cancel the previous request on your Ledger.');
                break;
            case LedgerApi.ErrorType.FAILED_LOADING_DEPENDENCIES:
                this.loadingFailed = true;
                this._onStateLoading(); // show as still loading / retrying
                break;
            case LedgerApi.ErrorType.NO_BROWSER_SUPPORT:
                this._showInstructions('', 'Ledger not supported by browser or support not enabled.');
                break;
            case LedgerApi.ErrorType.APP_OUTDATED:
                // TODO a firmware update is only required to update from 1.3.1 to 1.4.1. Remove this part of the
                // message in the future again
                this._showInstructions('', 'Your Nimiq App is outdated. ' +
                    'Please update your Ledger firmware and Nimiq App using Ledger Live.');
                break;
            case LedgerApi.ErrorType.WRONG_LEDGER:
                this._showInstructions('', 'The connected Ledger is not the one this account belongs to.');
                break;
            case LedgerApi.ErrorType.REQUEST_ASSERTION_FAILED:
                this._showInstructions('Request failed', `${this.small ? 'Request failed: ' : ''}${error.message}`);
                break;
            default:
                throw new Error(`Unhandled error: ${error.type} - ${error.message}`);
        }
    }

    private _cycleConnectInstructions() {
        const instructions = [
            '1. Connect your Ledger Device',
            '2. Enter your Pin',
            '3. Open the Nimiq App',
        ];
        const currentInstructionsIndex = instructions.indexOf(this.instructionsText);
        const nextInstructionsIndex = (currentInstructionsIndex + 1) % instructions.length;
        this._showInstructions('Connect Ledger', instructions[nextInstructionsIndex]);
    }

    private _showInstructions(title: string | null, text?: string): void {
        this.$emit(!title && !text ? LedgerUi.Events.NO_INFORMATION_SHOWN : LedgerUi.Events.INFORMATION_SHOWN);
        if (this.small) {
            // On small layout don't show a title but only the message, or if not available use the title as message
            this.instructionsTitle = '';
            this.instructionsText = text || title || '';
        } else {
            this.instructionsTitle = title || '';
            this.instructionsText = text || '';
        }
    }

    private get illustration() {
        switch (this.state.type) {
            case LedgerApi.StateType.LOADING:
            case LedgerApi.StateType.IDLE: // interpret IDLE as "waiting for request"
                return LedgerUi.Illustrations.LOADING;
            case LedgerApi.StateType.CONNECTING:
                return LedgerUi.Illustrations.CONNECTING;
            case LedgerApi.StateType.REQUEST_PROCESSING:
            case LedgerApi.StateType.REQUEST_CANCELLING:
                return this._computeIllustrationForRequestType(this.state.request!.type);
            case LedgerApi.StateType.ERROR:
                switch (this.state.error!.type) {
                    case LedgerApi.ErrorType.FAILED_LOADING_DEPENDENCIES:
                        return LedgerUi.Illustrations.LOADING;
                    case LedgerApi.ErrorType.REQUEST_ASSERTION_FAILED:
                        return this._computeIllustrationForRequestType(this.state.request!.type);
                    case LedgerApi.ErrorType.LEDGER_BUSY:
                        return this._computeIllustrationForRequestType(LedgerApi.currentRequest!.type);
                    case LedgerApi.ErrorType.NO_BROWSER_SUPPORT:
                    case LedgerApi.ErrorType.APP_OUTDATED:
                    case LedgerApi.ErrorType.WRONG_LEDGER:
                        return LedgerUi.Illustrations.IDLE;
                }
        }
    }

    private _computeIllustrationForRequestType(requestType: LedgerApi.RequestType): string {
        switch (requestType) {
            case LedgerApi.RequestType.GET_WALLET_ID:
            case LedgerApi.RequestType.GET_ADDRESS:
            case LedgerApi.RequestType.GET_PUBLIC_KEY:
            case LedgerApi.RequestType.DERIVE_ACCOUNTS:
                return LedgerUi.Illustrations.LOADING;
            case LedgerApi.RequestType.CONFIRM_ADDRESS:
                return LedgerUi.Illustrations.CONFIRM_ADDRESS;
            case LedgerApi.RequestType.SIGN_TRANSACTION:
                return LedgerUi.Illustrations.CONFIRM_TRANSACTION;
        }
    }
}

namespace LedgerUi {
    export const enum Events {
        NO_INFORMATION_SHOWN = 'no-information-shown',
        INFORMATION_SHOWN = 'information-shown',
    }

    export const enum Illustrations {
        IDLE = 'idle',
        LOADING = 'loading',
        CONNECTING = 'connecting',
        CONFIRM_ADDRESS = 'confirm-address',
        CONFIRM_TRANSACTION = 'confirm-transaction',
    }
}

export default LedgerUi;
</script>

<style scoped>
    .ledger-ui {
        width: 100%;
        text-align: center;
        display: flex;
        flex-direction: column;

        --ledger-connect-animation-duration: 9s;
        --ledger-scale-factor: 1.62;
        --ledger-opacity: .3;
    }

    .ledger-ui.small {
        --ledger-scale-factor: 1.5;
    }

    .status-screen {
        overflow: hidden;
    }

    .loading-spinner,
    .ledger-device-container {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        transition: opacity .4s;
    }

    .ledger-device-container {
        width: 52%;
    }

    .ledger-ui.small .ledger-device-container {
        margin-top: -2rem;
        width: 48%;
    }

    .ledger-device-container::before {
        /* fixed aspect ratio */
        content: "";
        display: block;
        padding-top: 21%;
    }

    .ledger-device-container * {
        position: absolute;
        background-repeat: no-repeat;
        background-position: center;
        background-size: contain;
    }

    .ledger-opacity-container {
        /* the ledger-device-container size and screen sizes were initially chosen such that the opacity container has
        exactly the size of the the ledger-device-container at scale factor 2. For other factors adapt size. */
        top: calc(50% * (1 - 2 / var(--ledger-scale-factor)));
        left: calc(50% * (1 - 2 / var(--ledger-scale-factor)));
        width: calc(100% * (2 / var(--ledger-scale-factor)));
        height: calc(100% * (2 / var(--ledger-scale-factor)));
    }

    .ledger-device,
    .ledger-cable {
        top: 0;
        width: 100%;
        height: 100%;
    }

    .ledger-opacity-container {
        transform: scale(var(--ledger-scale-factor)) translateX(27.3%);
        opacity: var(--ledger-opacity);
    }

    .ledger-device {
        background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 290 61" fill="white"><path d="M145.5 46C137 46 130 39 130 30.5S137 15 145.5 15 161 22 161 30.5 154 46 145.5 46zm0-29c-7.4 0-13.5 6.1-13.5 13.5S138.1 44 145.5 44 159 37.9 159 30.5 152.9 17 145.5 17z"/><path d="M285.5 3H107V2a2 2 0 0 0-2-2H89a2 2 0 0 0-2 2v1H41V2a2 2 0 0 0-2-2H23a2 2 0 0 0-2 2v1H4C1.8 3 0 4.8 0 7v47c0 2.2 1.8 4 4 4h281.5c2.5 0 4.5-2 4.5-4.5v-46c0-2.5-2-4.5-4.5-4.5zM102 40.9c0 1.1-.9 2.1-2 2.1H28c-1.1 0-2-.9-2-2.1V20.1c0-1.1.9-2.1 2-2.1h72c1.1 0 2 .9 2 2.1v20.8zm186 12.6c0 1.4-1.1 2.5-2.5 2.5h-140C131.4 56 120 44.6 120 30.5S131.4 5 145.5 5h140c1.4 0 2.5 1.1 2.5 2.5v46z"/></svg>');
    }

    .ledger-cable {
        right: 94.2%;
        background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 290 61"><path fill="white" d="M289.3 38.5c0 1.4-1 2.5-2 2.5h-18c-1.2 0-2-1.1-2-2.5v-16c0-1.4.8-2.5 2-2.5h18c1 0 2 1.1 2 2.5z" opacity=".7"/><path fill="%231f2348" d="M284.3 27h-8c-.7 0-1-.4-1-1s.3-1 1-1h8c.5 0 1 .4 1 1s-.5 1-1 1zM284.3 36h-8c-.7 0-1-.4-1-1s.3-1 1-1h8c.5 0 1 .4 1 1s-.5 1-1 1z" opacity=".5"/><path fill="white" d="M269.3 18h-27c-2.9 0-5 2.4-5 5.4V29H1.3v3h236v5.6c0 3 2.1 5.4 5 5.4h27c1 0 2-1 2-2.2V20.2c0-1.2-1-2.2-2-2.2z"/></svg>');
    }

    .ledger-screen {
        top: 10%;
        left: 24.25%;
        width: 51%;
        height: 77%;
        justify-content: center;
        align-items: center;
        display: none;
    }

    .ledger-screen-pin {
        background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 114 37.5"><path stroke="white" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12.2 17.5l-2.7 2.7-2.8-2.7M101.8 20.2l2.7-2.7 2.8 2.7"/><text fill="white" font-family="sans-serif" font-size="10" transform="translate(36.4 13.5)">PIN code</text></svg>');
    }

    .ledger-pin-dot {
        position: unset;
        margin: 1%;
        margin-top: 13%;
        width: 5%;
        height: 15.7%;
    }

    .ledger-screen-home {
        background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" fill="white" viewBox="0 0 114 37.5"><path fill="none" stroke="white" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M103.5 16.2l2.7 2.7-2.7 2.8m-93 .1L7.8 19l2.7-2.8M40.2 14.5h3.6m26.4 0h3.6"/><text font-family="sans-serif" font-size="11.2" transform="translate(41.3 32.3)">Nimiq</text><path d="M27.3 14.8h-.6v1.9h.2c.7 0 2.2 0 2.2-.9 0-.8-1-1-1.8-1zm1.4-1.7c0-.8-.9-.9-1.5-.9h-.5V14h.1c.7 0 1.9 0 1.9-.9z"/><path d="M27.5 7.5a7 7 0 0 0-7 7c0 3.9 3.1 7 7 7s7-3.1 7-7a7 7 0 0 0-7-7zm3.3 8.4c-.1 1.4-1.2 1.7-2.6 1.9v1.4h-.9v-1.4h-.7v1.4h-.8v-1.4h-1.7l.2-1h.7c.3 0 .3-.2.3-.3v-3.8c0-.2-.2-.4-.5-.4h-.6v-.9H26V9.9h.8v1.5h.7V9.9h.9v1.4c1.1.1 2 .4 2.1 1.4 0 .8-.3 1.2-.8 1.5.7.2 1.2.6 1.1 1.7zm33.5-2l-3.1-5.3c-.2-.4-.6-.6-1.1-.6h-6.3c-.4 0-.9.2-1.1.6l-3.1 5.3c-.2.4-.2.8 0 1.2l3.1 5.3c.2.4.6.6 1.1.6h6.3c.4 0 .9-.2 1.1-.6l3.1-5.3c.3-.4.3-.8 0-1.2zm22.2-6.4a7 7 0 0 0-7 7c0 3.9 3.1 7 7 7s7-3.1 7-7a7 7 0 0 0-7-7zm0 11.5l-3-4 3 1.8 3-1.8-3 4zm0-2.8l-3-1.7 3-4.5 3 4.5-3 1.7z"/></svg>');
    }

    .ledger-screen-app {
        background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 114 37.5"><g fill="white" stroke-width=".4"><path d="M34.2 17.7l-5.4-9.3a2.1 2.1 0 0 0-1.9-1.1H16.2a2.1 2.1 0 0 0-1.9 1L9 17.8a2.1 2.1 0 0 0 0 2.1l5.3 9.3a2.1 2.1 0 0 0 1.9 1.1h10.7a2.1 2.1 0 0 0 1.9-1l5.4-9.4a2.1 2.1 0 0 0 0-2.1zM53.2 12h2.4v13.5h-1.8l-7.4-9.4v9.4h-2.3V12H46l7.3 9.5zM60.2 25.6V12h2.5v13.6zM78.7 12h2v13.5h-2.2v-8.4l-3.7 8.4h-1.6l-3.7-8.4v8.4h-2.1V12h2L74 22.6zM85.3 25.6V12h2.5v13.6zM104.5 22.4a5.7 5.7 0 0 1-2.9 2.8 7.5 7.5 0 0 0 1.1 1.4 13.6 13.6 0 0 0 1.5 1.4l-1.8 1.3a10.4 10.4 0 0 1-1.7-1.6 11.4 11.4 0 0 1-1.4-2h-.6a7 7 0 0 1-3.5-.8 5.6 5.6 0 0 1-2.3-2.5 8.4 8.4 0 0 1-.8-3.7 8 8 0 0 1 .8-3.7 5.7 5.7 0 0 1 2.3-2.4 7.8 7.8 0 0 1 7 0 5.6 5.6 0 0 1 2.3 2.4 8 8 0 0 1 .8 3.7 8.3 8.3 0 0 1-.8 3.7zm-8.8 0a4.2 4.2 0 0 0 6 0c.7-.8 1.1-2 1.1-3.7s-.4-2.8-1-3.7a4.2 4.2 0 0 0-6.1 0c-.8.9-1.1 2.1-1.1 3.7s.3 2.9 1 3.8z"/></g></svg>');
    }

    .ledger-screen-confirm-address {
        background-image: url('data:image/svg+xml,svg xmlns="http://www.w3.org/2000/svg" fill="white" viewBox="0 0 114 37.5"><text font-family="sans-serif" font-size="11" transform="translate(36.5 16.5)"><tspan x="0" y="0">Confirm </tspan><tspan x="-.9" y="12">Address</tspan></text><path fill="none" stroke="white" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.2 21.2l-5.5-5.5m5.5.1l-5.5 5.5m98.5-5.5l-5.5 5.5-2.5-2.5"/></svg>');
    }

    .ledger-device-container[illustration="confirm-address"] .ledger-screen-confirm-address {
        display: block;
    }

    .ledger-screen-confirm-transaction {
        background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" fill="white" viewBox="0 0 114 37.5"><text font-family="sans-serif" font-size="11" transform="translate(36.5 16.5)"><tspan x="0" y="0">Confirm </tspan><tspan x="-10.2" y="12">Transaction</tspan></text><path fill="none" stroke="white" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.2 21.2l-5.5-5.5m5.5.1l-5.5 5.5m98.5-5.5l-5.5 5.5-2.5-2.5"/></svg>');
    }

    .ledger-device-container[illustration="confirm-transaction"] .ledger-screen-confirm-transaction {
        display: block;
    }

    /* Connect Animation */

    .ledger-device-container[illustration="connecting"] .ledger-cable {
        animation: ledger-connect-cable var(--ledger-connect-animation-duration) infinite;
    }
    .ledger-device-container[illustration="connecting"] .ledger-opacity-container {
        animation: ledger-scale-and-opacity var(--ledger-connect-animation-duration) both infinite;
    }
    .ledger-device-container[illustration="connecting"] .ledger-screen-pin {
        animation: ledger-show-screen-pin var(--ledger-connect-animation-duration) both infinite;
        display: flex;
    }
    .ledger-device-container[illustration="connecting"] .ledger-pin-dot {
        animation: ledger-show-pin-dot var(--ledger-connect-animation-duration) both infinite;
    }
    .ledger-device-container[illustration="connecting"] .ledger-screen-home {
        animation: ledger-show-screen-home var(--ledger-connect-animation-duration) both infinite;
        display: flex;
    }
    .ledger-device-container[illustration="connecting"] .ledger-screen-app {
        animation: ledger-show-screen-app var(--ledger-connect-animation-duration) both infinite;
        display: flex;
    }

    @keyframes ledger-connect-cable {
        0% {
            transform: translateX(-50%);
        }
        25% {
            transform: translateX(0);
        }
    }

    @keyframes ledger-scale-and-opacity {
        0% {
            opacity: 0;
            transform: scale(1);
        }
        3% {
            opacity: 1;
        }
        33% {
            opacity: 1;
            transform: scale(1);
        }
        42% {
            opacity: var(--ledger-opacity);
            transform: scale(var(--ledger-scale-factor)) translateX(27.3%);
        }
        98.5% {
            opacity: var(--ledger-opacity);
        }
        100% {
            opacity: 0;
            transform: scale(var(--ledger-scale-factor)) translateX(27.3%);
        }
    }

    @keyframes ledger-show-screen-pin {
        0%, 33%, 66%, 100% {
            opacity: 0;
        }
        35%, 64% {
            opacity: 1;
        }
        0%,
        33% {
            transform: scale(calc(1 / var(--ledger-scale-factor))) translateX(-105%);
        }
        42% {
            transform: scale(1);
        }
    }

    @keyframes ledger-show-pin-dot {
        0%, 37% {
            background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="30" height="3" x="1" y="28" fill="white" ry="1.5"/></svg>');
        }
        38%, 100% {
            background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="white"/></svg>');
        }
    }

    @keyframes ledger-show-screen-home {
        0%, 66%, 85%, 100% {
            opacity: 0;
        }
        68%, 83% {
            opacity: 1;
        }
    }

    @keyframes ledger-show-screen-app {
        0%, 85%, 100% {
            opacity: 0;
        }
        87%, 98% {
            opacity: 1;
        }
    }

    .ledger-ui .ledger-pin-dot:nth-child(2) {
        animation-delay: calc(1 * var(--ledger-connect-animation-duration) / 3.5 / 8);
    }
    .ledger-ui .ledger-pin-dot:nth-child(3) {
        animation-delay: calc(2 * var(--ledger-connect-animation-duration) / 3.5 / 8);
    }
    .ledger-ui .ledger-pin-dot:nth-child(4) {
        animation-delay: calc(3 * var(--ledger-connect-animation-duration) / 3.5 / 8);
    }
    .ledger-ui .ledger-pin-dot:nth-child(5) {
        animation-delay: calc(4 * var(--ledger-connect-animation-duration) / 3.5 / 8);
    }
    .ledger-ui .ledger-pin-dot:nth-child(6) {
        animation-delay: calc(5 * var(--ledger-connect-animation-duration) / 3.5 / 8);
    }
    .ledger-ui .ledger-pin-dot:nth-child(7) {
        animation-delay: calc(6 * var(--ledger-connect-animation-duration) / 3.5 / 8);
    }
    .ledger-ui .ledger-pin-dot:nth-child(8) {
        animation-delay: calc(7 * var(--ledger-connect-animation-duration) / 3.5 / 8);
    }
</style>
