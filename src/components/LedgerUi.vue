<template>
    <div class="ledger-ui" :illustration="illustration" :class="backgroundColor">
        <div class="ledger-device-container">
            <div class="ledger-cable"></div>
            <div class="ledger-device"></div>
            <div class="ledger-screen-loading ledger-screen"></div>
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
            <div class="ledger-screen-home ledger-screen"></div>
            <div class="ledger-screen-app ledger-screen"></div>
            <div class="ledger-screen-confirm-address ledger-screen"></div>
            <div class="ledger-screen-confirm-transaction ledger-screen"></div>
        </div>
        <h3 class="instructions-title">{{instructionsTitle}}</h3>
        <h4 class="instructions-text">
            <span v-for="line in instructionsText">{{line}}</span>
        </h4>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import LedgerApi from '../lib/LedgerApi';

@Component
class LedgerUi extends Vue {
    private state: LedgerApi.State = LedgerApi.currentState;
    private instructionsTitle: string = '';
    private instructionsText: string[] = [];
    private connectInstructionsTimer: number = -1;
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
        clearTimeout(this.connectInstructionsTimer);
        this.connectInstructionsTimer = -1;

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
                this._showInstructions('Please cancel the call on your Ledger');
                break;
            case LedgerApi.StateType.ERROR:
                this._onError(state);
                break;
        }
    }

    private _onStateLoading() {
        const retryMessage = this.loadingFailed ? 'Loading failed, retrying...' : '';
        this._showInstructions('Loading...', retryMessage);
    }

    private _onStateConnecting() {
        this.loadingFailed = false;
        // if ledger is already is already connected via USB and unlocked, establishing the API connection
        // usually takes < 250ms. Only if connecting takes longer, we show the connect instructions
        if (this.connectInstructionsTimer !== -1) return;
        this.connectInstructionsTimer = window.setTimeout(() => {
            this.connectInstructionsTimer = -1;
            if (LedgerApi.currentState.type !== LedgerApi.StateType.CONNECTING) return;
            this.state = LedgerApi.currentState;
            this._showInstructions(null); // instructions shown via css
        }, 300);
    }

    private _onRequest(state: LedgerApi.State) {
        const request = state.request!;
        switch (request.type) {
            case LedgerApi.RequestType.GET_PUBLIC_KEY:
            case LedgerApi.RequestType.GET_ADDRESS:
                // no UI needed as not interactive
                break;
            case LedgerApi.RequestType.LIST_ACCOUNTS:
                // not interactive, but takes ~6 seconds
                this._showInstructions('Fetching Accounts...');
                break;
            case LedgerApi.RequestType.CONFIRM_ADDRESS:
                this._showInstructions('Confirm Address', [
                    'Confirm that the address on your Ledger matches',
                    request.params.addressToConfirm!,
                ]);
                break;
            case LedgerApi.RequestType.SIGN_TRANSACTION:
                const transaction: Nimiq.Transaction = request.params.transactionToSign!;
                const instructions = [];
                // TODO support cashlink creation and extra data
                const isCashlinkCreation = false;
                if (isCashlinkCreation) {
                    instructions.push('Confirm on your Ledger if you want to create the following Cashlink:');
                } else {
                    instructions.push('Confirm on your Ledger if you want to send the following transaction:');
                }
                instructions.push(`From: ${transaction.sender.toUserFriendlyAddress()}`);
                if (!isCashlinkCreation) {
                    instructions.push(`To: ${transaction.recipient.toUserFriendlyAddress()}`);
                    // if (transaction.data && transaction.data.length !== 0) {
                    //     instructions.push(`Data: ${UTF8Tools.utf8ByteArrayToString(transaction.extraData)}`);
                    // }
                }
                instructions.push(`Value: ${Nimiq.Policy.satoshisToCoins(transaction.value)}`);
                instructions.push(`Fee: ${Nimiq.Policy.satoshisToCoins(transaction.fee)}`);
                this._showInstructions('Confirm Transaction', instructions);
                break;
            default:
                throw new Error(`Unhandled request: ${request.type}`);
        }
    }

    private _onError(state: LedgerApi.State) {
        const error = state.error!;
        switch (error.type) {
            case LedgerApi.ErrorType.LEDGER_BUSY:
                this._showInstructions('Please cancel the previous request on your Ledger.');
                break;
            case LedgerApi.ErrorType.FAILED_LOADING_DEPENDENCIES:
                this.loadingFailed = true;
                this._onStateLoading(); // show as still loading / retrying
                break;
            case LedgerApi.ErrorType.NO_BROWSER_SUPPORT:
                this._showInstructions('Ledger not supported by browser or support not enabled.');
                break;
            case LedgerApi.ErrorType.APP_OUTDATED:
                this._showInstructions('Your Nimiq App is outdated', 'Please update using Ledger Live.');
                break;
            case LedgerApi.ErrorType.REQUEST_ASSERTION_FAILED:
                this._showInstructions('Request failed', error.message);
                break;
            default:
                throw new Error(`Unhandled error: ${error.type} - ${error.message}`);
        }
    }

    private _showInstructions(title: string | null, text?: string | string[]): void {
        this.$emit(!title && !text && this.illustration === 'idle'
            ? LedgerUi.Events.NO_INFORMATION_SHOWN : LedgerUi.Events.INFORMATION_SHOWN);
        if (!title) {
            this.instructionsTitle = '';
        } else {
            this.instructionsTitle = title;
        }
        if (!text) {
            this.instructionsText = [];
        } else if (Array.isArray(text)) {
            this.instructionsText = text;
        } else {
            this.instructionsText = [text];
        }
    }

    private get illustration() {
        switch (this.state.type) {
            case LedgerApi.StateType.IDLE:
                return 'idle';
            case LedgerApi.StateType.LOADING:
                return 'loading';
            case LedgerApi.StateType.CONNECTING:
                return 'connecting';
            case LedgerApi.StateType.REQUEST_PROCESSING:
            case LedgerApi.StateType.REQUEST_CANCELLING:
                return this._computeIllustrationForRequestType(this.state.request!.type);
            case LedgerApi.StateType.ERROR:
                switch (this.state.error!.type) {
                    case LedgerApi.ErrorType.FAILED_LOADING_DEPENDENCIES:
                        return 'loading';
                    case LedgerApi.ErrorType.REQUEST_ASSERTION_FAILED:
                        return this._computeIllustrationForRequestType(this.state.request!.type);
                    case LedgerApi.ErrorType.LEDGER_BUSY:
                        return this._computeIllustrationForRequestType(LedgerApi.currentRequest!.type);
                    case LedgerApi.ErrorType.NO_BROWSER_SUPPORT:
                    case LedgerApi.ErrorType.APP_OUTDATED:
                        return 'idle';
                }
        }
    }

    private _computeIllustrationForRequestType(requestType: LedgerApi.RequestType): string {
        switch (requestType) {
            case LedgerApi.RequestType.GET_ADDRESS:
            case LedgerApi.RequestType.GET_PUBLIC_KEY:
            case LedgerApi.RequestType.LIST_ACCOUNTS:
                return 'loading';
            case LedgerApi.RequestType.CONFIRM_ADDRESS:
                return 'confirm-address';
            case LedgerApi.RequestType.SIGN_TRANSACTION:
                return 'confirm-transaction';
        }
    }

    private get backgroundColor() {
        if (this.state.type !== LedgerApi.StateType.ERROR) {
            return 'nq-bg-light-blue';
        } else if (this.state.error
            && (this.state.error.type === LedgerApi.ErrorType.REQUEST_ASSERTION_FAILED
                || this.state.error.type === LedgerApi.ErrorType.NO_BROWSER_SUPPORT)) {
            // more serious errors (either a request failed unexpectedly or browser not supported (an error from which
            // we can't recover))
            return 'nq-bg-red';
        } else {
            return 'nq-bg-orange';
        }
    }
}

namespace LedgerUi { // tslint:disable-line:no-namespace
    export const enum Events {
        NO_INFORMATION_SHOWN = 'no-information-shown',
        INFORMATION_SHOWN = 'information-shown',
    }
}

export default LedgerUi;
</script>

<style scoped>
    .ledger-ui {
        width: 100%;
        overflow: hidden;
        text-align: center;
        padding: 3rem 0;
        display: flex;
        flex-direction: column;

        --ledger-connect-animation-duration: 8s;
    }

    .ledger-ui .instructions-title {
        margin-left: 3rem;
        margin-right: 3rem;
    }

    .ledger-ui .instructions-text {
        opacity: .9;
        margin: 0;
        line-height: 1.4;
    }

    .ledger-ui .ledger-device-container {
        width: 50%;
        margin: auto;
        position: relative;
    }

    .ledger-ui .ledger-device-container::before {
        /* fixed aspect ratio */
        content: "";
        display: block;
        padding-top: 19.56%;
    }

    .ledger-ui .ledger-device-container > * {
        position: absolute;
    }

    /* TODO might be lazy loaded */
    .ledger-ui .ledger-device {
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" version="1" viewBox="0 0 910 178"><g transform="translate(0 -119)"><path d="M464 132h437v152H464c63-42 93-88 0-152z"/><path fill="%23ccc" d="M10 131v154h471c82-14 96-132-3-154zm458 38a41 39 0 0 1 32 15 41 39 0 0 1 5 7 41 39 0 0 1 1 3 41 39 0 0 1 2 4 41 39 0 0 1 1 8 41 39 0 0 1 0 3 41 39 0 0 1-1 7 41 39 0 0 1-2 8 41 39 0 0 1-4 7 41 39 0 0 1-8 8 41 39 0 0 1-7 4 41 39 0 0 1-4 2 41 39 0 0 1-4 1 41 39 0 0 1-4 1 41 39 0 0 1-4 1 41 39 0 0 1-3 0 41 39 0 0 1-19-5 41 39 0 0 1-13-10 41 39 0 0 1-2-3 41 39 0 0 1-2-4 41 39 0 0 1-2-3 41 39 0 0 1-2-8 41 39 0 0 1 0-4 41 39 0 0 1-1-2 41 39 0 0 1 2-12 41 39 0 0 1 6-11 41 39 0 0 1 33-17z"/><path fill="%23333745" stroke-width=".1" d="M198 178.7v11.1l.2 7.1h-.1c-1.4-2-2.9-3.2-4.5-4.2a15 15 0 0 0-5.7-1c-4.2 0-7.5 1.2-9.8 4.1a20 20 0 0 0-3.3 12.4c0 5 1 9 3.3 11.5 2.4 2.8 5.5 4.1 9.9 4.1s7.8-1.9 10.2-5.4l.7 4.9h1.9v-44.6zm-131.7 1.5a7.3 7.3 0 0 0-7.3 7.2v3.4h10.8v-10.6zm9.8 0v27.7h28v-20.5c0-4-3.3-7.2-7.2-7.2zm48.5 1.2v41.9h22.8v-2.9h-19.9v-39zm36.3 10.1a12 12 0 0 0-9.9 4.4 18 18 0 0 0-3.6 12c0 5 1.3 8.9 3.7 11.7a14 14 0 0 0 10.7 4.2 23.7 23.7 0 0 0 9.6-2V219a22.5 22.5 0 0 1-9.6 1.9c-3.7 0-6.6-1-8.4-3.3-2-2.2-3-5.6-3-9.8h22.4v-2.2c0-4.3-1-7.9-3.2-10.5a11 11 0 0 0-8.7-3.7zm55.5 0c-3.4 0-6 .8-8 2.7a10.4 10.4 0 0 0-2.8 7.5 9 9 0 0 0 5.6 9c-2.6 1.7-4 3.5-4 5.5a4 4 0 0 0 1 2.5c.4.7 1.2 1.3 2.1 1.7-2.1.6-4 1.5-5.3 3a7.5 7.5 0 0 0-2 5.3 7.1 7.1 0 0 0 3.1 6.2c2.2 1.6 5.2 2.4 9.2 2.4 4.9 0 8.6-.9 11.2-2.6 2.7-1.8 4-4.2 4-7.6 0-2.7-.9-4.9-2.7-6.1a13 13 0 0 0-7.7-2h-5.4c-1.8 0-3-.3-3.8-.7a2.4 2.4 0 0 1-1.1-2.2c0-1 .3-1.7.9-2.6.5-.7 1.4-1.5 2.6-2h2.8a11.1 11.1 0 0 0 8-2.6c2.1-2 3.1-4.2 3.1-7.3 0-2.5-.9-4.8-2.6-7l6.4-.4v-2.1h-9.8c-1.1-.5-2.7-.6-4.8-.6zm27.7 0c-4.2 0-7.3 1.4-9.8 4.4a18 18 0 0 0-3.7 12c0 5 1.4 8.9 3.9 11.7 2.6 2.7 6 4.2 10.5 4.2a23.7 23.7 0 0 0 9.9-2V219a22.5 22.5 0 0 1-9.8 1.9c-3.6 0-6.4-1-8.3-3.3-2-2.2-3.1-5.6-3.1-9.8H256v-2.2c0-4.3-1-7.9-3.1-10.5a11 11 0 0 0-8.8-3.7zm28 .1c-2 0-3.7.5-5.4 1.5a11 11 0 0 0-4 4.7h-.2l-.3-5.6h-2.5v31h3v-17c0-3.5.7-6.2 2.5-8.5a7.8 7.8 0 0 1 6.5-3.4c1.3 0 2.7.1 4 .5l.6-2.7a15 15 0 0 0-4.2-.5zm-55.5 2.2a8.4 8.4 0 0 1 5.4 2c1.4 1.3 2.2 3.3 2.2 6 0 2.4-.6 4.3-2 5.6a8.5 8.5 0 0 1-6 2c-2.5 0-4.4-.7-5.9-2a7.8 7.8 0 0 1-2.1-5.7c0-2.4.5-4.4 2-5.8 1.4-1.5 3.4-2.1 5.8-2.1a8.4 8.4 0 0 1 .6 0zm-55 .3a7.4 7.4 0 0 1 5.6 3c1.6 2 2.4 4.8 2.4 8.5h-19.2a15 15 0 0 1 3.2-8.7 10 10 0 0 1 7.3-2.8 7.4 7.4 0 0 1 .6 0zm83.5 0a7.4 7.4 0 0 1 5.6 3c1.6 2 2.3 4.8 2.3 8.5h-19.2c.3-3.9 1.5-6.6 3.3-8.7a9.8 9.8 0 0 1 7.3-2.8 7.4 7.4 0 0 1 .7 0zm-57.2 0c3.6 0 6.2 1 7.7 3.3 1.6 2 2.5 5.6 2.4 10.3v.5c0 4.7-.8 8-2.4 10-1.6 2.1-4.2 3.1-7.7 3.1-6.8 0-10.4-4.3-10.4-13.1 0-4.7 1-8.2 2.7-10.5a9 9 0 0 1 7.7-3.6zM59 197.4v10.8h10.8v-10.8zm0 17.1v3.5c0 3.9 3.2 7.3 7.3 7.3h3.5v-10.8zm17.1 0v10.8H87v-10.8zm17.2 0v10.8h3.5c3.8 0 7.2-3.2 7.2-7.3v-3.5zm121 7.2h5.1c2.8 0 4.9.3 6.2 1.2 1.3 1 1.8 2.2 1.8 4.1 0 5.2-4 7.8-12 7.8-6.6 0-9.7-2.1-9.7-6.3 0-4.6 3-6.7 8.6-6.8z" opacity=".2"/><ellipse cx="468" cy="208" fill="none" stroke="%23000" stroke-width="8" rx="38" ry="36"/><path d="M578 124h63v23h-63zm204 0h61v21h-61z"/><path fill="white" fill-opacity=".2" d="M599 173h221v70H599z"/><path fill="white" fill-opacity=".1" d="M821 212v-39H649z"/></g></svg>');
    }

    .ledger-ui .ledger-cable {
        left: 93.4%;
        top: 0;
        width: 100%;
        height: 100%;
        background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" version="1" viewBox="0 0 910 178"><path fill="%23ccc" d="M0 63h55v52H0z"/><path d="M53 55v68h109c10 0 18-6 18-14V69c0-8-8-14-18-14H72z"/><rect width="772" height="12" x="139" y="83" ry="4"/><rect width="29.5" height="4.1" x="12.4" y="76.3" opacity=".2" ry="2"/><rect width="29.5" height="4.1" x="12.4" y="97.6" opacity=".2" ry="2"/><path fill="white" stroke-width="0" d="M106 73c-3 0-6 2-6 5v2h8v-7zm7 0v20h20V78c0-3-2-5-5-5zm-13 12v8h8v-8zm0 13v2c0 3 3 5 6 5h2v-7zm13 0v7h8v-7zm12 0v7h3c3 0 5-2 5-5v-2z"/></svg>');
    }

    .ledger-ui .ledger-screen {
        top: 31%;
        left: 66%;
        width: 24%;
        height: 39%;
        justify-content: center;
        align-items: center;
        display: none;
    }

    .ledger-ui .ledger-pin-dot {
        margin: 2%;
        width: 5%;
        height: 15.7%;
        background-color: #21b6ff;
        border-radius: 50%;
    }

    .ledger-ui .ledger-screen-loading {
        background-image: url('data:image/svg+xml;base64,PHN2ZyB2ZXJzaW9uPSIxLjEiIHZpZXdCb3g9IjAgMCA2NCA2NCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48c3R5bGU+QGtleWZyYW1lcyBhe3Rve3RyYW5zZm9ybTpyb3RhdGUoMjQwZGVnKSB0cmFuc2xhdGVaKDApO319I2NpcmNsZXthbmltYXRpb246MnMgYSBpbmZpbml0ZSBsaW5lYXI7dHJhbnNmb3JtOnJvdGF0ZSgtMTIwZGVnKSB0cmFuc2xhdGVaKDApO3RyYW5zZm9ybS1vcmlnaW46Y2VudGVyO308L3N0eWxlPjxkZWZzPjxjbGlwUGF0aCBpZD0iYSI+PHBhdGggZD0iTTE5LjUgMy41YTcgNyAwIDAgMC02IDMuNEwxIDI4LjNhNi44IDYuOCAwIDAgMCAwIDdsMTIuNCAyMS4yYTcgNyAwIDAgMCA2IDMuNWgyNWE3IDcgMCAwIDAgNi4xLTMuNGwxMi42LTIxLjRhNi45IDYuOSAwIDAgMCAwLTdMNTAuNiA3YTcgNyAwIDAgMC02LTMuNHptMCA0aDI1YzEgMCAyIC42IDIuNiAxLjVsMTIuNSAyMS4zYy41IDEgLjUgMiAwIDNMNDcuMSA1NC40YTMgMyAwIDAgMS0yLjYgMS41aC0yNWMtMSAwLTItLjYtMi42LTEuNUw0LjQgMzMuMmMtLjUtMS0uNS0yIDAtMi45TDE2LjkgOWEzIDMgMCAwIDEgMi42LTEuNXoiIGNsaXAtcnVsZT0iZXZlbm9kZCIvPjwvY2xpcFBhdGg+PC9kZWZzPjxnIGNsaXAtcGF0aD0idXJsKCNhKSI+PGNpcmNsZSBpZD0iY2lyY2xlIiBjeD0iMzIiIGN5PSIzMiIgcj0iMTYiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzIxYjZmZiIgc3Ryb2tlLWRhc2hhcnJheT0iMTYuNjY2IDg0LjY2NiIgc3Ryb2tlLXdpZHRoPSIzMiIvPjwvZz48L3N2Zz4K');
        background-repeat: no-repeat;
        background-size: 25%;
        background-position: center;
    }

    .ledger-ui[illustration="loading"] .ledger-screen-loading {
        display: block;
    }

    .ledger-ui .ledger-screen-home {
        background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" version="1" viewBox="0 0 221 70" fill="%2321b6ff"><path d="M56.6 15.5c-6.4 0-11.5 5-11.5 11.4v1.3c0 6.3 5.1 11.4 11.5 11.4h2.3c6.4 0 11.5-5.1 11.5-11.4v-1.3c0-6.3-5.1-11.4-11.5-11.4h-2.3zm-1.7 4h1.5V22h1.2v-2.4h1.5V22c1.9.1 3.4.7 3.6 2.4 0 1.3-.5 2-1.3 2.5 1.4.4 2.3 1.2 2.1 3-.2 2.4-2 3-4.4 3.2v2.4h-1.5v-2.4h-1.2v2.4H55v-2.4h-3l.4-1.8h1c.5 0 .6-.3.6-.5v-6.6c0-.3-.3-.7-.9-.7h-1V22h3v-2.5zm2.4 4.1h-.8v3c.8 0 3.4.2 3.4-1.5 0-1.3-1.5-1.5-2.6-1.5zm.2 4.4h-1v3.3c1 0 4 .2 4-1.6 0-1.4-1.7-1.6-3-1.7zm103.3-12.5c-6.3 0-11.4 5-11.4 11.4v1.3c0 6.3 5 11.4 11.4 11.4h2.4c6.3 0 11.4-5.1 11.4-11.4v-1.3c0-6.3-5-11.4-11.4-11.4h-2.4zm1.2 4l5 8.2-5 2.9-4.9-3 5-8zm-5 9.1l5 2.9 4.9-2.9-5 7-4.9-7z"/><rect width="7.5" height="2.3" x="80.1" y="26.4" ry="0"/><rect width="7.5" height="2.3" x="132.2" y="26.4" ry="0"/><path fill="none" stroke="%2321b6ff" d="M20.3 30.7l-4.6 4.6 4.6 4.5m179.4 0l4.5-4.5-4.6-4.6"/><text style="line-height:1.25" x="82.6" y="60.5" font-family="sans-serif" font-size="18.7" letter-spacing="0" word-spacing="0"><tspan x="82.6" y="60.5">Nimiq</tspan></text><path fill-rule="evenodd" d="M117.5 16.6a2.5 2.5 0 0 0-2-1.1h-11.3c-.7 0-1.6.5-2 1.1l-5.7 9.8a3 3 0 0 0 0 2.3l5.7 9.7c.4.6 1.3 1.1 2 1.1h11.4a3 3 0 0 0 2-1l5.6-9.8c.4-.7.4-1.7 0-2.3zm-6.3 18v2.2H109v-2.2a7.3 7.3 0 0 1-3.8-1.6l1.4-2.2c1.1.8 2 1.3 3.1 1.3 1.2 0 1.8-.5 1.8-1.5 0-2.2-5.8-2.2-5.8-6.1a4 4 0 0 1 3.3-4v-2.2h2.2v2.2a5 5 0 0 1 3.2 1.7l-1.6 1.9c-.8-.8-1.5-1.1-2.4-1.1-1 0-1.6.4-1.6 1.4 0 2 5.8 1.8 5.8 6a4 4 0 0 1-3.4 4.1z"/></svg>');
    }

    .ledger-ui .ledger-screen-app {
        background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" version="1" viewBox="0 0 221 70" fill="%2321b6ff"><text x="78.8" y="43.1" font-family="sans-serif" font-size="29.3" letter-spacing="0" style="line-height:1.25" word-spacing="0"><tspan x="78.8" y="43.1">Nimiq</tspan></text><path fill-rule="evenodd" d="M54 16.4c-.6-1.1-2.1-2-3.3-2H31.2c-1.3 0-2.8.9-3.4 2L18 33c-.7 1-.7 2.8 0 3.8l9.7 16.7c.6 1.1 2.1 2 3.4 2h19.5c1.2 0 2.7-.9 3.3-2L63.8 37c.6-1 .6-2.8 0-3.8zM43.1 47v3.8h-3.6v-3.7c-2.2-.2-4.8-1.2-6.6-2.8l2.4-3.7a9 9 0 0 0 5.3 2.2c2.1 0 3-.9 3-2.6 0-3.8-9.8-3.7-9.8-10.4 0-3.6 2.2-6.1 5.7-6.8v-3.8H43v3.7c2.4.3 4.1 1.5 5.6 3l-2.8 3.2c-1.3-1.3-2.5-1.9-4-1.9-1.9 0-2.8.7-2.8 2.4 0 3.5 9.8 3.2 9.8 10.3 0 3.5-2 6.3-5.8 7z"/></svg>');
    }

    .ledger-ui .ledger-screen-confirm-address {
        background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" version="1" viewBox="0 0 221 70"><g fill="%2321b6ff"><text x="62.3" y="28.8" font-family="sans-serif" font-size="26.7" letter-spacing="0" style="line-height:1.25" word-spacing="0">Confirm</text><path d="M33.8 23.6L24.3 33l-9.5-9.5-1.9 1.9 9.5 9.5-9.5 9.5 2 2 9.4-9.6 9.5 9.5 2-1.9-9.6-9.5 9.5-9.5zM204.5 25L188 41.2l-7-7.2-2 2 7.2 7 1.9 2 2-2 16.3-16.3z"/><text x="62" y="55.1" font-family="sans-serif" font-size="26.7" letter-spacing="0" style="line-height:1.25">address</text></g></svg>');
    }

    .ledger-ui[illustration="confirm-address"] .ledger-screen-confirm-address {
        display: block;
    }

    .ledger-ui .ledger-screen-confirm-transaction {
        background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" version="1" viewBox="0 0 221 70"><g fill="%2321b6ff"><text x="68.3" y="28.8" font-family="sans-serif" font-size="24" letter-spacing="0" style="line-height:1.25" word-spacing="0">Confirm</text><path d="M33.8 23.6L24.3 33l-9.5-9.5-1.9 1.9 9.5 9.5-9.5 9.5 2 2 9.4-9.6 9.5 9.5 2-1.9-9.6-9.5 9.5-9.5zM204.5 25L188 41.2l-7-7.2-2 2 7.2 7 1.9 2 2-2 16.3-16.3z"/><text x="50" y="55.1" font-family="sans-serif" font-size="24" letter-spacing="0" style="line-height:1.25">transaction</text></g></svg>');
    }

    .ledger-ui[illustration="confirm-transaction"] .ledger-screen-confirm-transaction {
        display: block;
    }

    /* Connect Animation */

    .ledger-ui[illustration="connecting"] .ledger-cable {
        animation: ledger-connect-cable var(--ledger-connect-animation-duration) infinite;
        display: flex;
    }
    .ledger-ui[illustration="connecting"] .ledger-screen-pin {
        animation: ledger-show-screen-pin var(--ledger-connect-animation-duration) both infinite;
        display: flex;
    }
    .ledger-ui[illustration="connecting"] .ledger-pin-dot {
        animation: ledger-show-pin-dot var(--ledger-connect-animation-duration) both infinite;
    }
    .ledger-ui[illustration="connecting"] .ledger-screen-home {
        animation: ledger-show-screen-home var(--ledger-connect-animation-duration) both infinite;
        display: flex;
    }
    .ledger-ui[illustration="connecting"] .ledger-screen-app {
        animation: ledger-show-screen-app var(--ledger-connect-animation-duration) both infinite;
        display: flex;
    }
    .ledger-ui[illustration="connecting"] .instructions-text::after {
        content: "";
        text-align: center;
        animation: ledger-connect-instructions-text var(--ledger-connect-animation-duration) both infinite linear;
    }

    @keyframes ledger-connect-cable {
        0% {
            transform: translateX(50%);
        }
        25% {
            transform: translateX(0);
        }
    }

    @keyframes ledger-show-screen-pin {
        0%, 33%, 66%, 100% {
            opacity: 0;
        }
        35%, 64% {
            opacity: 1;
        }
    }

    @keyframes ledger-show-pin-dot {
        0%, 34% {
            opacity: 0;
        }
        35%, 66%, 100% {
            opacity: 1;
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

    @keyframes ledger-connect-instructions-text {
        0%, 33% {
            content: "1. Connect your Ledger Device.";
        }
        34%, 66% {
            content: "2. Enter your Pin.";
        }
        67%, 100% {
            content: "3. Open the Nimiq App.";
        }

        0%, 33.5%, 66.5%, 100% {
            opacity: 0;
        }

        1%, 32%, 35%, 65%, 68%, 99% {
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
