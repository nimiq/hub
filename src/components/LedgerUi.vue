<template>
    <div class="ledger-ui" :class="{ small, 'has-connect-button': showConnectButton }">
        <StatusScreen :state="'loading'" :title="instructionsTitle" :status="instructionsText" :small="small">
            <template slot="loading">
                <transition name="transition-fade">
                    <LoadingSpinner v-if="illustration === constructor.Illustrations.LOADING"/>
                    <div v-else class="ledger-device-container" :illustration="illustration"
                        :connect-animation-step="connectAnimationStep">
                        <div class="ledger-screen-confirm-address ledger-screen"></div>
                        <div class="ledger-screen-confirm-transaction ledger-screen"></div>
                        <div class="ledger-screen-app ledger-screen"></div>
                        <div class="ledger-screen-dashboard ledger-screen"></div>
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
                <transition name="transition-fade">
                    <button v-if="showConnectButton" class="nq-button-s inverse connect-button"
                        :class="{ pulsate: connectAnimationStep === 4 }" @click="_connect">
                        Connect
                    </button>
                </transition>
            </template>
        </StatusScreen>
    </div>
</template>

<script lang="ts">
import { Component, Prop, Vue, Watch } from 'vue-property-decorator';
import { LoadingSpinner } from '@nimiq/vue-components';
import LedgerApi, { ErrorType, EventType, RequestType, State, StateType } from '@nimiq/ledger-api';
import StatusScreen from '../components/StatusScreen.vue';

@Component({ components: { StatusScreen, LoadingSpinner } })
class LedgerUi extends Vue {
    private static CONNECT_ANIMATION_STEP_DURATION = 9000 / 3;

    @Prop(Boolean) public small?: boolean;

    private state: State = LedgerApi.currentState;
    private instructionsTitle: string = '';
    private instructionsText: string = '';
    private showConnectButton: boolean = false;
    private connectAnimationStep: number = -1;
    private connectAnimationInterval: number = -1;
    private connectTimer: number = -1;
    private loadingFailed: boolean = false;

    private created() {
        this._onStateChange = this._onStateChange.bind(this);
        LedgerApi.on(EventType.STATE_CHANGE, this._onStateChange);
        this._onStateChange(LedgerApi.currentState);
    }

    private destroyed() {
        LedgerApi.off(EventType.STATE_CHANGE, this._onStateChange);
        clearTimeout(this.connectTimer);
        clearInterval(this.connectAnimationInterval);
    }

    private _connect() {
        // Manual connection in the context of a user gesture.
        LedgerApi.connect();
    }

    private get illustration() {
        switch (this.state.type) {
            case StateType.LOADING:
            case StateType.IDLE: // interpret IDLE as "waiting for request"
                return LedgerUi.Illustrations.LOADING;
            case StateType.CONNECTING:
                return LedgerUi.Illustrations.CONNECTING;
            case StateType.REQUEST_PROCESSING:
            case StateType.REQUEST_CANCELLING:
                return this._getIllustrationForRequestType(this.state.request!.type);
            case StateType.ERROR:
                return this._getIllustrationForErrorType(this.state.error!.type);
        }
    }

    private _getIllustrationForRequestType(requestType: RequestType): string {
        switch (requestType) {
            case RequestType.GET_WALLET_ID:
            case RequestType.GET_ADDRESS:
            case RequestType.GET_PUBLIC_KEY:
            case RequestType.DERIVE_ADDRESSES:
                return LedgerUi.Illustrations.LOADING;
            case RequestType.CONFIRM_ADDRESS:
                return LedgerUi.Illustrations.CONFIRM_ADDRESS;
            case RequestType.SIGN_TRANSACTION:
                return LedgerUi.Illustrations.CONFIRM_TRANSACTION;
        }
    }

    private _getIllustrationForErrorType(errorType: ErrorType): string {
        switch (errorType) {
            case ErrorType.LOADING_DEPENDENCIES_FAILED:
                return LedgerUi.Illustrations.LOADING;
            case ErrorType.USER_INTERACTION_REQUIRED:
            case ErrorType.CONNECTION_ABORTED: // keep animation running and ask user to use the connect button
                return LedgerUi.Illustrations.CONNECTING;
            case ErrorType.REQUEST_ASSERTION_FAILED:
                return this._getIllustrationForRequestType(this.state.request!.type);
            case ErrorType.LEDGER_BUSY:
                return this._getIllustrationForRequestType(LedgerApi.currentRequest!.type);
            case ErrorType.NO_BROWSER_SUPPORT:
            case ErrorType.APP_OUTDATED:
            case ErrorType.WRONG_LEDGER:
                return LedgerUi.Illustrations.IDLE;
        }
    }

    private _onStateChange(state: State) {
        if (state.type === StateType.CONNECTING) {
            this.loadingFailed = false;
            // If connecting, only switch to connecting state if connecting takes some time. If ledger is already
            // connected via USB and unlocked, establishing the API connection usually takes < 1s.
            this.connectTimer = window.setTimeout(() => {
                if (LedgerApi.currentState.type !== StateType.CONNECTING) return;
                this.state = LedgerApi.currentState;
            }, 1050);
            return;
        }
        clearTimeout(this.connectTimer);

        this.state = state;
        switch (state.type) {
            case StateType.IDLE:
                this._showInstructions(null);
                break;
            case StateType.LOADING:
                this._onStateLoading();
                break;
            case StateType.REQUEST_PROCESSING:
                this._onRequest(state);
                break;
            case StateType.REQUEST_CANCELLING:
                this._showInstructions('', 'Please cancel the request on your Ledger');
                break;
            case StateType.ERROR:
                this._onError(state);
                break;
            default:
                throw new Error(`Unhandled state: ${state.type}`);
        }
    }

    private _onStateLoading() {
        const retryMessage = this.loadingFailed ? 'Loading failed, retrying...' : '';
        this._showInstructions('', retryMessage);
    }

    private _onRequest(state: State) {
        const request = state.request!;
        switch (request.type) {
            case RequestType.GET_WALLET_ID:
            case RequestType.GET_PUBLIC_KEY:
            case RequestType.GET_ADDRESS:
                // no instructions needed as not interactive
                break;
            case RequestType.DERIVE_ADDRESSES:
                // not interactive, but takes ~6 seconds
                this._showInstructions('Fetching Addresses');
                break;
            case RequestType.CONFIRM_ADDRESS:
                this._showInstructions('Confirm Address',
                    `Confirm that the address on your Ledger matches ${request.params.addressToConfirm!}`);
                break;
            case RequestType.SIGN_TRANSACTION:
                this._showInstructions('Confirm Transaction',
                    'Confirm using your Ledger');
                break;
            default:
                throw new Error(`Unhandled request: ${request.type}`);
        }
    }

    private _onError(state: State) {
        const error = state.error!;
        switch (error.type) {
            case ErrorType.LEDGER_BUSY:
                this._showInstructions('', 'Please cancel the previous request on your Ledger.');
                break;
            case ErrorType.LOADING_DEPENDENCIES_FAILED:
                this.loadingFailed = true;
                this._onStateLoading(); // show as still loading / retrying
                break;
            case ErrorType.USER_INTERACTION_REQUIRED:
            case ErrorType.CONNECTION_ABORTED:
                // No instructions to set here. The state change triggers the connection animation and instruction loop.
                // Set showConnectButton as flag and not have it as a getter depending on the state such that the
                // animation loop continues to include the fourth step for consistency even when the error is resolved
                // and the api switches to the connecting state.
                this.showConnectButton = true;
                break;
            case ErrorType.NO_BROWSER_SUPPORT:
                this._showInstructions('', 'Ledger not supported by browser.');
                break;
            case ErrorType.APP_OUTDATED:
                this._showInstructions('', 'Your Nimiq App is outdated. ' +
                    'Please update your Ledger firmware and Nimiq App using Ledger Live.');
                break;
            case ErrorType.WRONG_LEDGER:
                this._showInstructions('', 'The connected Ledger is not the one this account belongs to.');
                break;
            case ErrorType.REQUEST_ASSERTION_FAILED:
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
        if (this.showConnectButton) {
            instructions.push('4. Click "Connect"');
        }
        const oldInstructionIndex = instructions.indexOf(this.instructionsText);
        const instructionIndex = (oldInstructionIndex + 1) % instructions.length;
        this._showInstructions('Connect Ledger', instructions[instructionIndex]);
        this.connectAnimationStep = instructionIndex + 1; // Set animation step which starts counting at 1
    }

    @Watch('illustration', { immediate: true })
    private _onIllustrationChange(illustration: string) {
        if (illustration === LedgerUi.Illustrations.CONNECTING) {
            this._cycleConnectInstructions();
            this.connectAnimationInterval =
                window.setInterval(() => this._cycleConnectInstructions(), LedgerUi.CONNECT_ANIMATION_STEP_DURATION);
        } else {
            clearInterval(this.connectAnimationInterval);
            this.connectAnimationStep = -1;
            this.showConnectButton = false;
        }
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

        --ledger-connect-animation-step-duration: 3s;
        --ledger-container-width: 52%;
        --ledger-scale-factor: 1.62;
        --ledger-y-offset: 0rem; /* unit can't be omitted here */
        --ledger-opacity: .3;
    }

    .ledger-ui.small {
        --ledger-container-width: 48%;
        --ledger-scale-factor: 1.5;
        --ledger-y-offset: -2rem;
    }

    .ledger-ui.has-connect-button.small {
        --ledger-container-width: 44%;
        --ledger-y-offset: -3.5rem;
    }

    .status-screen {
        overflow: hidden;
    }

    .status-screen >>> .status-row {
        transition: margin-bottom .4s;
    }

    .ledger-ui.has-connect-button .status-screen >>> .status-row {
        margin-bottom: 7rem;
        pointer-events: none;
    }

    .ledger-ui.has-connect-button.small .status-screen >>> .status-row {
        margin-bottom: 5.5rem;
    }

    .connect-button {
        position: absolute;
        width: 10rem;
        left: calc(50% - 5rem);
        bottom: 2rem;
        transition: opacity .4s;
    }

    .connect-button.pulsate:not(:hover):not(:focus) {
        animation: connect-button-pulsate calc(var(--ledger-connect-animation-step-duration) / 4) alternate infinite;
    }

    .ledger-ui.small .connect-button {
        bottom: 1rem;
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
        width: var(--ledger-container-width);
        transform: translate(-50%, calc(-50% + var(--ledger-y-offset)));
        transition: opacity .4s, transform .4s, width .4s;
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

    .ledger-screen-dashboard {
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

    .ledger-device-container[illustration="connecting"][connect-animation-step="1"] .ledger-opacity-container {
        animation: ledger-fade-in var(--ledger-connect-animation-step-duration) both;
    }
    .ledger-device-container[illustration="connecting"][connect-animation-step="1"] .ledger-cable {
        animation: ledger-connect-cable var(--ledger-connect-animation-step-duration) both;
    }

    .ledger-device-container[illustration="connecting"][connect-animation-step="2"] .ledger-opacity-container {
        animation: ledger-scale var(--ledger-connect-animation-step-duration) both;
    }
    .ledger-device-container[illustration="connecting"][connect-animation-step="2"] .ledger-screen-pin {
        animation: ledger-show-screen-pin var(--ledger-connect-animation-step-duration) both;
        display: flex;
    }
    .ledger-device-container[illustration="connecting"][connect-animation-step="2"] .ledger-pin-dot {
        animation: ledger-show-pin-dot var(--ledger-connect-animation-step-duration) both;
    }

    .ledger-device-container[illustration="connecting"][connect-animation-step="3"] .ledger-opacity-container {
        animation: ledger-fade-out var(--ledger-connect-animation-step-duration) both;
    }
    .ledger-device-container[illustration="connecting"][connect-animation-step="3"] .ledger-screen-dashboard {
        animation: ledger-show-screen-dashboard var(--ledger-connect-animation-step-duration) both;
        display: flex;
    }
    .ledger-device-container[illustration="connecting"][connect-animation-step="3"] .ledger-screen-app {
        animation: ledger-show-screen-app var(--ledger-connect-animation-step-duration) both;
        display: flex;
    }

    .has-connect-button [illustration="connecting"][connect-animation-step="3"] .ledger-opacity-container,
    .has-connect-button [illustration="connecting"][connect-animation-step="4"] .ledger-opacity-container {
        /* Span animation over two animation steps via animation delay */
        animation: ledger-fade-out var(--ledger-connect-animation-step-duration)
            var(--ledger-connect-animation-step-duration) both;
    }
    .has-connect-button [illustration="connecting"][connect-animation-step="3"] .ledger-screen-app,
    .has-connect-button [illustration="connecting"][connect-animation-step="4"] .ledger-screen-app {
        /* Use animation with double the duration */
        animation: ledger-show-screen-app-double-duration calc(2 * var(--ledger-connect-animation-step-duration)) both;
        display: flex;
    }

    @keyframes ledger-connect-cable {
        0% {
            transform: translateX(-50%);
        }
        75%, 100% {
            transform: translateX(0);
        }
    }

    @keyframes ledger-fade-in {
        0% {
            opacity: 0;
            transform: scale(1);
        }
        10%, 100% {
            opacity: 1;
            transform: scale(1);
        }
    }

    @keyframes ledger-scale {
        0% {
            opacity: 1;
            transform: scale(1);
        }
        25%, 100% {
            opacity: var(--ledger-opacity);
            transform: scale(var(--ledger-scale-factor)) translateX(27.3%);
        }
    }

    @keyframes ledger-fade-out {
        0%, 95% {
            opacity: var(--ledger-opacity);
        }
        100% {
            opacity: 0;
        }
    }

    @keyframes ledger-show-screen-pin {
        0% {
            opacity: 0;
            transform: scale(calc(1 / var(--ledger-scale-factor))) translateX(-105%);
        }
        5% {
            opacity: 1;
        }
        25% {
            transform: scale(1);
        }
        95% {
            opacity: 1;
        }
        100% {
            opacity: 0;
        }
    }

    @keyframes ledger-show-pin-dot {
        0%, 12% {
            background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="30" height="3" x="1" y="28" fill="white" ry="1.5"/></svg>');
        }
        17%, 100% {
            background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="white"/></svg>');
        }
    }

    @keyframes ledger-show-screen-dashboard {
        0% {
            opacity: 0;
        }
        5%, 50% {
            opacity: 1;
        }
        55%, 100% {
            opacity: 0;
        }
    }

    @keyframes ledger-show-screen-app {
        0%, 55% {
            opacity: 0;
        }
        60%, 95% {
            opacity: 1;
        }
        100% {
            opacity: 0;
        }
    }

    @keyframes ledger-show-screen-app-double-duration {
        0%, 27.5% {
            opacity: 0;
        }
        30%, 97.5% {
            opacity: 1;
        }
        100% {
            opacity: 0;
        }
    }

    @keyframes connect-button-pulsate {
        100% {
            background-color: rgba(255, 255, 255, var(--ledger-opacity));
        }
    }

    .ledger-ui .ledger-pin-dot:nth-child(2) {
        animation-delay: calc(1 * var(--ledger-connect-animation-step-duration) / 1.15 / 8) !important;
    }
    .ledger-ui .ledger-pin-dot:nth-child(3) {
        animation-delay: calc(2 * var(--ledger-connect-animation-step-duration) / 1.15 / 8) !important;
    }
    .ledger-ui .ledger-pin-dot:nth-child(4) {
        animation-delay: calc(3 * var(--ledger-connect-animation-step-duration) / 1.15 / 8) !important;
    }
    .ledger-ui .ledger-pin-dot:nth-child(5) {
        animation-delay: calc(4 * var(--ledger-connect-animation-step-duration) / 1.15 / 8) !important;
    }
    .ledger-ui .ledger-pin-dot:nth-child(6) {
        animation-delay: calc(5 * var(--ledger-connect-animation-step-duration) / 1.15 / 8) !important;
    }
    .ledger-ui .ledger-pin-dot:nth-child(7) {
        animation-delay: calc(6 * var(--ledger-connect-animation-step-duration) / 1.15 / 8) !important;
    }
    .ledger-ui .ledger-pin-dot:nth-child(8) {
        animation-delay: calc(7 * var(--ledger-connect-animation-step-duration) / 1.15 / 8) !important;
    }
</style>
