<template>
    <div class="loader" :class="showLoadingBackground && (lightBlue ? 'nq-bg-light-blue' : 'nq-bg-blue')">
        <transition name="fade-loading">
            <div class="wrapper" v-if="state === 'loading'">
                <h1 class="title nq-h1">{{ loadingTitle }}</h1>

                <div class="icon-row">
                    <div class="nq-icon loading"></div>
                </div>

                <div class="status-row" :class="{'transition': isStatusTransitioning}">
                    <div class="status current nq-h2">{{ currentStatus }}</div>
                    <div class="status next nq-h2">{{ nextStatus }}</div>
                </div>
            </div>
        </transition>

        <transition name="fade-result">
            <div class="wrapper success nq-bg-green" v-if="state === 'success'">
                <div class="icon-row">
                    <div class="success nq-icon"></div>

                    <h1 class="title nq-h1">{{ title }}</h1>
                </div>

            </div>
        </transition>

        <transition name="fade-result">
            <div class="wrapper warning nq-bg-orange" v-if="state === 'warning'">
                <div class="top-spacer" :class="{'with-main-action': !!mainAction, 'with-alternative-action': !!alternativeAction}"></div>

                <div class="icon-row">
                    <div class="warning nq-icon"></div>

                    <h1 class="title nq-h1">{{ title }}</h1>
                    <p v-if="message" class="message nq-text">{{ message }}</p>
                </div>

                <div class="action-row">
                    <button v-if="mainAction" class="nq-button orange inverse" @click="onMainAction">{{ mainAction }}</button>
                    <a v-if="alternativeAction" href="javascript:void(0)" class="alternative-action nq-link" @click="onAlternativeAction">{{ alternativeAction }}</a>
                </div>
            </div>
        </transition>

        <transition name="fade-result">
            <div class="wrapper error nq-bg-red" v-if="state === 'error'">
                <div class="top-spacer" :class="{'with-main-action': !!mainAction, 'with-alternative-action': !!alternativeAction}"></div>

                <div class="icon-row">
                    <div class="error nq-icon"></div>

                    <h1 class="title nq-h1">{{ title }}</h1>
                    <p v-if="message" class="message nq-text">{{ message }}</p>
                </div>

                <div class="action-row">
                    <button v-if="mainAction" class="main-action nq-button red inverse" @click="onMainAction">{{ mainAction }}</button>
                    <a v-if="alternativeAction" href="javascript:void(0)" class="alternative-action nq-link" @click="onAlternativeAction">{{ alternativeAction }}</a>
                </div>
            </div>
        </transition>
    </div>
</template>

<script lang="ts">
import { Component, Prop, Watch, Emit, Vue } from 'vue-property-decorator';

/**
 * **Nimiq Loader Component**
 *
 * Props:
 *
 * **title** {string} The current title, dynamic for both loading and result states
 *
 * **status** {string} [optional] Currently doing this
 *
 * **state** {'loading'|'success'|'warning'|'error'} [optional, default 'loading']
 *
 * **lightBlue** {boolean} [optional, default false] Show light blue loading screen
 *
 * **message** {string} [optional] Message displayed for warning and error states
 *
 * **mainAction** {string} [optional] Text of main action button (button is hidden otherwise)
 *
 * **alternativeAction** {string} [optional] Text of alternative action link (link is hidden otherwise)
 *
 * Events:
 *
 * **@main-action**
 *
 * **@alternative-action**
 *
 * The `state` is available as `Loader.Status.LOADING`, `Loader.Status.SUCCESS`,
 * `Loader.Status.WARNING` and `Loader.Status.ERROR`.
 *
 * The events are available as `Loader.Events.MAIN_ACTION` and `Loader.Events.ALTERNATIVE_ACTION`.
 */
@Component
class Loader extends Vue {
    @Prop({type: String, default: 'Improving the world'}) private title!: string;
    @Prop({type: String, default: Loader.Status.LOADING}) private state!: string;
    @Prop(Boolean) private lightBlue?: boolean;
    @Prop(String) private status?: string;
    @Prop(String) private message?: string;
    @Prop(String) private mainAction?: string;
    @Prop(String) private alternativeAction?: string;

    private currentStatus: string = '';
    private nextStatus: string = '';
    private isStatusTransitioning: boolean = false;

    /**
     * To enable a smooth transition of the non-transitionable background-image
     * property, we instead place the new background above the old one and
     * animate the top element's opacity. But because the color area has rounded
     * corners, and the browser creates transparent pixels in the corner
     * because of anti-aliasing, the blue background partly shines through the
     * transparent corner pixels of the foreground. Thus we remove the background
     * color after the transition is complete.
     */
    private showLoadingBackground: boolean = true;

    private _loadingTitle?: string;

    private get loadingTitle() {
        return this._loadingTitle || (this._loadingTitle = this.title);
    }

    @Watch('state', {immediate: true})
    private updateState(newState: string, oldState: string) {
        // When the component is initialized with a state other than LOADING
        if (!oldState && (newState !== Loader.Status.LOADING)) {
            this.showLoadingBackground = false;
        }

        // When the state changes later and animates
        if (oldState && (newState !== Loader.Status.LOADING)) {
            setTimeout(() => this.showLoadingBackground = false, 1000);
        }

        if (newState === Loader.Status.LOADING) {
            this.showLoadingBackground = true;
        }
    }

    @Watch('status', {immediate: true})
    private updateStatus(newStatus: string, oldStatus: string) {
        this.nextStatus = newStatus;
        this.isStatusTransitioning = true;

        setTimeout(() => {
            this.currentStatus = newStatus;
            this.isStatusTransitioning = false;
        }, 500);
    }

    private onMainAction() {
        this.$emit(Loader.Events.MAIN_ACTION);
    }

    private onAlternativeAction() {
        this.$emit(Loader.Events.ALTERNATIVE_ACTION);
    }
}

namespace Loader { // tslint:disable-line no-namespace
    export enum Status {
        LOADING = 'loading',
        SUCCESS = 'success',
        WARNING = 'warning',
        ERROR = 'error',
    }

    export enum Events {
        MAIN_ACTION = 'main-action',
        ALTERNATIVE_ACTION = 'alternative-action',
    }
}

export default Loader;
</script>

<style scoped>
    .loader {
        display: flex;
        flex-direction: column;
        border-radius: 0.5rem;
        height: 100%;
        margin: 0.75rem;
        z-index: 1000;
        position: relative;
    }

    .wrapper {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: center;
        flex-grow: 1;
        border-radius: 0.5rem;
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
    }

    .wrapper.success {
        justify-content: center;
    }

    .title {
        line-height: 1;
        margin-top: 4rem;
        white-space: pre;
    }

    .icon-row,
    .status-row,
    .action-row {
        width: 100%;
        text-align: center;
    }

    .success .icon-row {
        margin-top: 2rem;
    }

    .icon-row .nq-icon {
        margin: auto;
    }

    .nq-icon.loading {
        width: 7rem;
        height: 7rem;
        background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCIgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0Ij48c3R5bGU+QGtleWZyYW1lcyBhe3Rve3RyYW5zZm9ybTpyb3RhdGUoMjQwZGVnKSB0cmFuc2xhdGVaKDApO319I2NpcmNsZXthbmltYXRpb246M3MgYSBpbmZpbml0ZSBsaW5lYXI7dHJhbnNmb3JtOnJvdGF0ZSgtMTIwZGVnKSB0cmFuc2xhdGVaKDApO3RyYW5zZm9ybS1vcmlnaW46Y2VudGVyO308L3N0eWxlPjxkZWZzPjxjbGlwUGF0aCBpZD0iaGV4Q2xpcCI+PHBhdGggY2xpcC1ydWxlPSJldmVub2RkIiBkPSJtIDE5LjQ5MjE4OCwzLjUgYyAtMi40ODMxNTQsMCAtNC43OTAwMywxLjMwNTAwOSAtNi4wNTI3MzUsMy40MzU1NDY5IGwgLTAuMDAyLDAuMDA1ODYgTCAwLjk1MTE3MTg4LDI4LjI3MzQzOCBjIC0xLjI2Nzg5NDg1LDIuMTM5Mjk2IC0xLjI2NzIzMjE1LDQuODExNTk3IDAsNi45NTExNzEgMy4zMTI2ZS00LDUuNmUtNCAtMy4zMTQ0ZS00LDAuMDAxNCAwLDAuMDAyIEwgMTMuNDQ1MzEyLDU2LjUxOTUzMSBDIDE0LjY4NzkxMSw1OC42ODcxODggMTcuMDA5MDM1LDYwIDE5LjQ5MjE4OCw2MCBoIDI0Ljk5ODA0NiBjIDIuNDgzMTUzLDAgNC43OTAwMzEsLTEuMzA1MDA1IDYuMDUyNzM1LC0zLjQzNTU0NyBsIDAuMDAyLC0wLjAwMzkgMTIuNTA5NzY2LC0yMS4zMjQyMTkgYyAxLjI1NjQ3OSwtMi4xNDYyMDkgMS4yNjI3MDUsLTQuODE0ODMyIDAsLTYuOTUzMTI1IGwgLTAuMDAyLC0wLjAwMzkgLTEyLjQ4ODI4MSwtMjEuMzM3ODkwOCAtMC4wMDM5LC0wLjAwNTg2IEMgNDkuMjk3ODQzLDQuODA1MDA4NyA0Ni45OTA5NjcsMy41IDQ0LjUwNzgxMiwzLjUgWiBtIDAsNCBoIDI1LjAxNTYyNCBjIDEuMDc5ODI2LDAgMi4wNzM3OSwwLjU2OTU4MzMgMi42MTEzMjksMS40NzY1NjI1IGwgMTIuNDg2MzI4LDIxLjMzMjAzMTUgMC4wMDM5LDAuMDAzOSBjIDAuNTMyMDE2LDAuODk3NjYxIDAuNTM2MDgsMS45NzY2NTEgLTAuMDA1OSwyLjkwMjM0NCBsIC0xMi41MDE5NTQsMjEuMzA4NTk0IC0wLjAwMzksMC4wMDIgQyA0Ni41NTk2MTYsNTUuNDMwMjM2IDQ1LjU2ODYwNCw1NiA0NC40OTAyMzQsNTYgSCAxOS40OTIxODggYyAtMS4wNzk4MjYsMCAtMi4wNTc5ODYsLTAuNTYxMzkgLTIuNTc4MTI2LC0xLjQ2ODc1IGwgLTAuMDAzOSwtMC4wMDk4IC0xMi41MTU2MjQ4LC0yMS4zMzIwMzEgLTAuMDAxOTUsLTAuMDAyIGMgLTAuNTMyMDE1NywtMC44OTc2NjEgLTAuNTMyMDE1NywtMS45NzczMzkgMCwtMi44NzUgbCAwLjAwMTk1LC0wLjAwMzkgTCAxNi44ODA4NTksOC45NzY1NjI1IEMgMTcuNDE4Mzk5LDguMDY5NTgzIDE4LjQxMjM2Myw3LjUgMTkuNDkyMTg4LDcuNSBaIi8+PC9jbGlwUGF0aD48L2RlZnM+PHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBkPSJtIDE5LjQ5MjE4OCwzLjUgYyAtMi40ODMxNTQsMCAtNC43OTAwMywxLjMwNTAwOSAtNi4wNTI3MzUsMy40MzU1NDY5IGwgLTAuMDAyLDAuMDA1ODYgTCAwLjk1MTE3MTg4LDI4LjI3MzQzOCBjIC0xLjI2Nzg5NDg1LDIuMTM5Mjk2IC0xLjI2NzIzMjE1LDQuODExNTk3IDAsNi45NTExNzEgMy4zMTI2ZS00LDUuNmUtNCAtMy4zMTQ0ZS00LDAuMDAxNCAwLDAuMDAyIEwgMTMuNDQ1MzEyLDU2LjUxOTUzMSBDIDE0LjY4NzkxMSw1OC42ODcxODggMTcuMDA5MDM1LDYwIDE5LjQ5MjE4OCw2MCBoIDI0Ljk5ODA0NiBjIDIuNDgzMTUzLDAgNC43OTAwMzEsLTEuMzA1MDA1IDYuMDUyNzM1LC0zLjQzNTU0NyBsIDAuMDAyLC0wLjAwMzkgMTIuNTA5NzY2LC0yMS4zMjQyMTkgYyAxLjI1NjQ3OSwtMi4xNDYyMDkgMS4yNjI3MDUsLTQuODE0ODMyIDAsLTYuOTUzMTI1IGwgLTAuMDAyLC0wLjAwMzkgLTEyLjQ4ODI4MSwtMjEuMzM3ODkwOCAtMC4wMDM5LC0wLjAwNTg2IEMgNDkuMjk3ODQzLDQuODA1MDA4NyA0Ni45OTA5NjcsMy41IDQ0LjUwNzgxMiwzLjUgWiBtIDAsNCBoIDI1LjAxNTYyNCBjIDEuMDc5ODI2LDAgMi4wNzM3OSwwLjU2OTU4MzMgMi42MTEzMjksMS40NzY1NjI1IGwgMTIuNDg2MzI4LDIxLjMzMjAzMTUgMC4wMDM5LDAuMDAzOSBjIDAuNTMyMDE2LDAuODk3NjYxIDAuNTM2MDgsMS45NzY2NTEgLTAuMDA1OSwyLjkwMjM0NCBsIC0xMi41MDE5NTQsMjEuMzA4NTk0IC0wLjAwMzksMC4wMDIgQyA0Ni41NTk2MTYsNTUuNDMwMjM2IDQ1LjU2ODYwNCw1NiA0NC40OTAyMzQsNTYgSCAxOS40OTIxODggYyAtMS4wNzk4MjYsMCAtMi4wNTc5ODYsLTAuNTYxMzkgLTIuNTc4MTI2LC0xLjQ2ODc1IGwgLTAuMDAzOSwtMC4wMDk4IC0xMi41MTU2MjQ4LC0yMS4zMzIwMzEgLTAuMDAxOTUsLTAuMDAyIGMgLTAuNTMyMDE1NywtMC44OTc2NjEgLTAuNTMyMDE1NywtMS45NzczMzkgMCwtMi44NzUgbCAwLjAwMTk1LC0wLjAwMzkgTCAxNi44ODA4NTksOC45NzY1NjI1IEMgMTcuNDE4Mzk5LDguMDY5NTgzIDE4LjQxMjM2Myw3LjUgMTkuNDkyMTg4LDcuNSBaIiBmaWxsPSIjZmZmIiBvcGFjaXR5PSIuNCIvPjxnIGNsaXAtcGF0aD0idXJsKCNoZXhDbGlwKSI+PGNpcmNsZSBpZD0iY2lyY2xlIiBjeD0iMzIiIGN5PSIzMiIgcj0iMTYiIGZpbGw9Im5vbmUiIHN0cm9rZS13aWR0aD0iMzIiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLWRhc2hhcnJheT0iMTYuNjY2IDg0LjY2NiIvPjwvZz48L3N2Zz4=');
    }

    .nq-icon.success {
        width: 9rem;
        height: 9rem;
        background-image: url('data:image/svg+xml,<svg width="74" height="74" viewBox="0 0 74 74" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M71.1219 1.8436C69.1022 0.394771 66.2911 0.858411 64.8429 2.8792L22.7383 61.617L8.68342 47.5419C7.54679 46.4041 5.88983 45.9594 4.3367 46.3754C2.78357 46.7915 1.57022 48.0049 1.15372 49.5588C0.737223 51.1126 1.18084 52.7708 2.31747 53.9086L20.1223 71.7209C21.0679 72.6313 22.3587 73.0916 23.6667 72.9848C24.9746 72.878 26.1737 72.2144 26.9593 71.1625L72.1569 8.12622C73.6049 6.10533 73.1415 3.29258 71.1219 1.8436Z" fill="white" stroke="white" stroke-width="0.8"/></svg>');
    }

    .nq-icon.warning {
        width: 10rem;
        height: 10rem;
        background-image: url('data:image/svg+xml,<svg width="75" height="74" viewBox="0 0 75 74" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M39.8365 49.2798C39.8365 50.8448 38.5617 52.1253 36.991 52.1253C35.4203 52.1253 34.1455 50.8448 34.1455 49.2798V30.6531C34.1455 29.0767 35.4203 27.8076 36.991 27.8076C38.5617 27.8076 39.8365 29.0767 39.8365 30.6531V49.2798ZM36.991 62.4718C35.4203 62.4718 34.1455 61.197 34.1455 59.6263C34.1455 58.0555 35.4203 56.7808 36.991 56.7808C38.5617 56.7808 39.8365 58.0555 39.8365 59.6263C39.8365 61.197 38.5617 62.4718 36.991 62.4718ZM73.3682 69.1074L39.5351 1.44694C38.5676 -0.482313 35.4148 -0.482313 34.4473 1.44694L0.301268 69.7391C-0.13694 70.6212 -0.0971029 71.6683 0.420779 72.5106C0.944352 73.3472 1.86061 73.8537 2.84515 73.8537H71.1373C71.1771 73.8594 71.2227 73.8594 71.2511 73.8537C72.8218 73.8537 74.0966 72.5846 74.0966 71.0082C74.0966 70.2797 73.8235 69.6139 73.3682 69.1074Z" fill="white"/></svg>');
    }

    .nq-icon.error {
        width: 12rem;
        height: 12rem;
        background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 102 102" height="102" width="102"><circle fill="none" stroke-width="6" stroke="white" r="48" cy="51" cx="51" /><circle r="4.8243198" cy="38.739731" cx="35.148571" fill="white" /><circle r="4.8243198" cy="38.739239" cx="66.851433" fill="white" /><path d="m 39.972931,69.06373 c 0,0 4.8243,-2.7567 11.027,-2.7567 6.2027,0 11.0271,2.7567 11.0271,2.7567" fill="none" stroke="white" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" /></svg>');
    }

    .status-row {
        margin-top: 2rem; /* Same as title margin-bottom, to equalize spacing to center icon */
        margin-bottom: 5rem;
    }

    .status {
        line-height: 1;
        margin: 0;
        font-weight: normal;
        height: 2.5rem;
        opacity: 1;
    }

    .status.next {
        margin-top: -2.5rem;
        transform: translateY(2.5rem);
        opacity: 0;
    }

    .status-row.transition .status {
        transition: transform 500ms, opacity 500ms;
    }

    .status-row.transition .status.current {
        transform: translateY(-2.5rem);
        opacity: 0;
    }

    .status-row.transition .status.next {
        transform: translateY(0);
        opacity: 1;
    }

    .top-spacer {
        padding-top: 2rem;
    }

    .top-spacer.with-main-action {
        padding-bottom: 8rem;
    }

    .top-spacer.with-alternative-action {
        margin-bottom: 2rem;
    }

    .icon-row .title,
    .icon-row .message {
        margin-left: auto;
        margin-right: auto;
    }

    .icon-row .title {
        max-width: 80%;
        line-height: 1.4;
    }

    .message {
        max-width: 70%;
        opacity: 1;
    }

    .action-row {
        padding-bottom: 2rem;
    }

    /* FADE transitions */

    .fade-loading-leave-active,
    .fade-result-leave-active {
        transition: opacity 300ms;
    }

    .fade-loading-enter-active,
    .fade-result-enter-active {
        transition: opacity 700ms 300ms;
    }

    .fade-loading-enter,
    .fade-loading-leave-to,
    .fade-result-enter,
    .fade-result-leave-to {
        opacity: 0;
    }
</style>
