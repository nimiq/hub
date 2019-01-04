<template>
    <div id="app">
        <header class="logo icon-logo">
            <span class="nq-icon nimiq-logo"></span>
            <strong>Nimiq</strong>
        </header>
        <div style="flex-grow: 1;"></div>
        <div v-if="!isRequestLoaded" class="loading">
            <div class="loading-animation"></div>
            <h2>Loading, hold on</h2>
        </div>
        <router-view v-else/>
        <div style="flex-grow: 1;"></div>
    </div>
</template>

<script lang="ts">
import { Component, Watch, Vue } from 'vue-property-decorator';
import { State } from 'vuex-class';

import '@nimiq/style/nimiq-style.min.css';
import '@nimiq/style/nimiq-style-icons.min.css';
import '@nimiq/vue-components/dist/NimiqVueComponents.css';

@Component
export default class App extends Vue {
    @State('hasRpcState') private hasRpcState!: boolean;
    @State('hasRequest') private hasRequest!: boolean;

    private isRequestLoaded = false;

    public created() {
        this.$store.dispatch('initWallets');
    }

    public mounted() {
        this.checkLoaded();
    }

    @Watch('hasRpcState')
    private onRpcStateChange() {
        this.checkLoaded();
    }

    @Watch('hasRequest')
    private onRequestChange() {
        this.checkLoaded();
    }

    private checkLoaded() {
        this.isRequestLoaded = !!this.hasRpcState && !!this.hasRequest;
    }
}
</script>

<style>
    html, body {
        height: 100%;
    }

    @media (max-width: 450px) {
        html {
            font-size: 7px;
            --nimiq-size: 7px; /* For @nimiq/vue-components */
        }
    }

    .logo {
        height: 3.625rem;
        box-sizing: border-box;
        flex-shrink: 0;
        font-size: 3rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        display: flex;
        align-items: center;
        color: var(--nimiq-blue);
        z-index: 1;
        text-decoration: none;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
        outline: none !important;
    }

    .logo .nimiq-logo {
        height: 4rem;
        width: 4rem;
        margin-right: calc(.382 * 4rem); /* 0.382 times the signet width following the style guide */
    }

    .logo :not(.nimiq-logo) {
        margin-top: -.2rem; /* perfectly center text, accounting for spacing present in font */
    }

    .logo strong {
        margin-left: -.25rem; /* subtract small margin before letter N present in font */
    }

    /* Subtitle (e.g. NIMIQ Checkout) */
    .logo :not(.nimiq-logo):not(strong) {
        font-weight: 100;
        text-transform: none;
        letter-spacing: initial;
        margin-left: 1.15rem;
    }

    #app > header {
        box-sizing: content-box;
        width: calc(100% - 2 * 3rem); /* minus padding */
        padding: 4rem 3rem;
    }

    #app {
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 0 1rem;
    }

    .loading {
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .loading-animation {
        opacity: 1;
        background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCIgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0Ij48c3R5bGU+QGtleWZyYW1lcyBhe3Rve3RyYW5zZm9ybTpyb3RhdGUoMjQwZGVnKSB0cmFuc2xhdGVaKDApO319I2NpcmNsZXthbmltYXRpb246MnMgYSBpbmZpbml0ZSBsaW5lYXI7dHJhbnNmb3JtOnJvdGF0ZSgtMTIwZGVnKSB0cmFuc2xhdGVaKDApO3RyYW5zZm9ybS1vcmlnaW46Y2VudGVyO308L3N0eWxlPjxkZWZzPjxjbGlwUGF0aCBpZD0iaGV4Q2xpcCI+PHBhdGggY2xpcC1ydWxlPSJldmVub2RkIiBkPSJtIDE5LjQ5MjE4OCwzLjUgYyAtMi40ODMxNTQsMCAtNC43OTAwMywxLjMwNTAwOSAtNi4wNTI3MzUsMy40MzU1NDY5IGwgLTAuMDAyLDAuMDA1ODYgTCAwLjk1MTE3MTg4LDI4LjI3MzQzOCBjIC0xLjI2Nzg5NDg1LDIuMTM5Mjk2IC0xLjI2NzIzMjE1LDQuODExNTk3IDAsNi45NTExNzEgMy4zMTI2ZS00LDUuNmUtNCAtMy4zMTQ0ZS00LDAuMDAxNCAwLDAuMDAyIEwgMTMuNDQ1MzEyLDU2LjUxOTUzMSBDIDE0LjY4NzkxMSw1OC42ODcxODggMTcuMDA5MDM1LDYwIDE5LjQ5MjE4OCw2MCBoIDI0Ljk5ODA0NiBjIDIuNDgzMTUzLDAgNC43OTAwMzEsLTEuMzA1MDA1IDYuMDUyNzM1LC0zLjQzNTU0NyBsIDAuMDAyLC0wLjAwMzkgMTIuNTA5NzY2LC0yMS4zMjQyMTkgYyAxLjI1NjQ3OSwtMi4xNDYyMDkgMS4yNjI3MDUsLTQuODE0ODMyIDAsLTYuOTUzMTI1IGwgLTAuMDAyLC0wLjAwMzkgLTEyLjQ4ODI4MSwtMjEuMzM3ODkwOCAtMC4wMDM5LC0wLjAwNTg2IEMgNDkuMjk3ODQzLDQuODA1MDA4NyA0Ni45OTA5NjcsMy41IDQ0LjUwNzgxMiwzLjUgWiBtIDAsNCBoIDI1LjAxNTYyNCBjIDEuMDc5ODI2LDAgMi4wNzM3OSwwLjU2OTU4MzMgMi42MTEzMjksMS40NzY1NjI1IGwgMTIuNDg2MzI4LDIxLjMzMjAzMTUgMC4wMDM5LDAuMDAzOSBjIDAuNTMyMDE2LDAuODk3NjYxIDAuNTM2MDgsMS45NzY2NTEgLTAuMDA1OSwyLjkwMjM0NCBsIC0xMi41MDE5NTQsMjEuMzA4NTk0IC0wLjAwMzksMC4wMDIgQyA0Ni41NTk2MTYsNTUuNDMwMjM2IDQ1LjU2ODYwNCw1NiA0NC40OTAyMzQsNTYgSCAxOS40OTIxODggYyAtMS4wNzk4MjYsMCAtMi4wNTc5ODYsLTAuNTYxMzkgLTIuNTc4MTI2LC0xLjQ2ODc1IGwgLTAuMDAzOSwtMC4wMDk4IC0xMi41MTU2MjQ4LC0yMS4zMzIwMzEgLTAuMDAxOTUsLTAuMDAyIGMgLTAuNTMyMDE1NywtMC44OTc2NjEgLTAuNTMyMDE1NywtMS45NzczMzkgMCwtMi44NzUgbCAwLjAwMTk1LC0wLjAwMzkgTCAxNi44ODA4NTksOC45NzY1NjI1IEMgMTcuNDE4Mzk5LDguMDY5NTgzIDE4LjQxMjM2Myw3LjUgMTkuNDkyMTg4LDcuNSBaIi8+PC9jbGlwUGF0aD48L2RlZnM+PHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBkPSJtIDE5LjQ5MjE4OCwzLjUgYyAtMi40ODMxNTQsMCAtNC43OTAwMywxLjMwNTAwOSAtNi4wNTI3MzUsMy40MzU1NDY5IGwgLTAuMDAyLDAuMDA1ODYgTCAwLjk1MTE3MTg4LDI4LjI3MzQzOCBjIC0xLjI2Nzg5NDg1LDIuMTM5Mjk2IC0xLjI2NzIzMjE1LDQuODExNTk3IDAsNi45NTExNzEgMy4zMTI2ZS00LDUuNmUtNCAtMy4zMTQ0ZS00LDAuMDAxNCAwLDAuMDAyIEwgMTMuNDQ1MzEyLDU2LjUxOTUzMSBDIDE0LjY4NzkxMSw1OC42ODcxODggMTcuMDA5MDM1LDYwIDE5LjQ5MjE4OCw2MCBoIDI0Ljk5ODA0NiBjIDIuNDgzMTUzLDAgNC43OTAwMzEsLTEuMzA1MDA1IDYuMDUyNzM1LC0zLjQzNTU0NyBsIDAuMDAyLC0wLjAwMzkgMTIuNTA5NzY2LC0yMS4zMjQyMTkgYyAxLjI1NjQ3OSwtMi4xNDYyMDkgMS4yNjI3MDUsLTQuODE0ODMyIDAsLTYuOTUzMTI1IGwgLTAuMDAyLC0wLjAwMzkgLTEyLjQ4ODI4MSwtMjEuMzM3ODkwOCAtMC4wMDM5LC0wLjAwNTg2IEMgNDkuMjk3ODQzLDQuODA1MDA4NyA0Ni45OTA5NjcsMy41IDQ0LjUwNzgxMiwzLjUgWiBtIDAsNCBoIDI1LjAxNTYyNCBjIDEuMDc5ODI2LDAgMi4wNzM3OSwwLjU2OTU4MzMgMi42MTEzMjksMS40NzY1NjI1IGwgMTIuNDg2MzI4LDIxLjMzMjAzMTUgMC4wMDM5LDAuMDAzOSBjIDAuNTMyMDE2LDAuODk3NjYxIDAuNTM2MDgsMS45NzY2NTEgLTAuMDA1OSwyLjkwMjM0NCBsIC0xMi41MDE5NTQsMjEuMzA4NTk0IC0wLjAwMzksMC4wMDIgQyA0Ni41NTk2MTYsNTUuNDMwMjM2IDQ1LjU2ODYwNCw1NiA0NC40OTAyMzQsNTYgSCAxOS40OTIxODggYyAtMS4wNzk4MjYsMCAtMi4wNTc5ODYsLTAuNTYxMzkgLTIuNTc4MTI2LC0xLjQ2ODc1IGwgLTAuMDAzOSwtMC4wMDk4IC0xMi41MTU2MjQ4LC0yMS4zMzIwMzEgLTAuMDAxOTUsLTAuMDAyIGMgLTAuNTMyMDE1NywtMC44OTc2NjEgLTAuNTMyMDE1NywtMS45NzczMzkgMCwtMi44NzUgbCAwLjAwMTk1LC0wLjAwMzkgTCAxNi44ODA4NTksOC45NzY1NjI1IEMgMTcuNDE4Mzk5LDguMDY5NTgzIDE4LjQxMjM2Myw3LjUgMTkuNDkyMTg4LDcuNSBaIiBmaWxsPSIjZmZmIiBvcGFjaXR5PSIuMiIvPjxnIGNsaXAtcGF0aD0idXJsKCNoZXhDbGlwKSI+PGNpcmNsZSBpZD0iY2lyY2xlIiBjeD0iMzIiIGN5PSIzMiIgcj0iMTYiIGZpbGw9Im5vbmUiIHN0cm9rZS13aWR0aD0iMzIiIHN0cm9rZT0iIzFERTlCNiIgc3Ryb2tlLWRhc2hhcnJheT0iMTYuNjY2IDg0LjY2NiIvPjwvZz48L3N2Zz4=');
        background-repeat: no-repeat;
        background-position: center;
        background-size: 100%;
        z-index: 1;
        display: block;
        height: 10rem;
        width: 10rem;
    }

    .loading-animation + h2 {
        margin-top: 4rem;
        padding-bottom: 8rem;
        text-transform: uppercase;
        font-size: 1.75rem;
        font-weight: 600;
        line-height: 0.86;
        letter-spacing: 0.143em;
    }

    #app > .container {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
        flex-shrink: 0;
    }

    .container.pad-bottom {
        margin-bottom: 12.5rem; /* Same height as the header (~100px) */
    }

    .global-close {
        margin-top: 8rem;
        margin-bottom: 5rem;
    }

    .global-close .arrow-left {
        vertical-align: top;
        margin-right: 0.25rem;
    }

    .global-close.hidden {
        visibility: hidden;
        pointer-events: none;
    }
</style>
