<template>
    <div id="app">
        <header class="logo-container">
            <div class="logo icon-logo">
                <span class="nq-icon nimiq-logo"></span>
                <strong>Nimiq</strong>
            </div>
        </header>
        <div v-if="!isRequestLoaded" class="loading">
            <div class="loading-animation"></div>
            <h2>Loading, hold on</h2>
        </div>
        <router-view v-else/>
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
  @media (max-width: 450px) {
        html {
            --nimiq-size: 7px; /* For @nimiq/vue-components */
        }
    }

    #app > .container {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
        flex-shrink: 0;
        justify-content: center;
        flex-grow: 1;
    }

    #app > .container.pad-bottom {
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
