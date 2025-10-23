<template>
    <div id="app">
        <header class="logo">
            <span class="nq-icon nimiq-logo"></span>
            <span class="logo-wordmark">Nimiq</span>
            <span class="logo-subtitle"></span>
        </header>
        <div v-if="!isLoaded || $root.loading" class="loading">
            <LoadingSpinner/>
        </div>
        <router-view v-else/>
    </div>
</template>

<script lang="ts">
import { Component, Watch, Vue } from 'vue-property-decorator';
import { State } from 'vuex-class';
import { REQUEST_ERROR } from './router';
import { LoadingSpinner } from '@nimiq/vue-components';

import '@nimiq/style/nimiq-style.min.css';
import '@nimiq/vue-components/dist/NimiqVueComponents.css';
import { loadBitcoinJS } from './lib/bitcoin/BitcoinJSLoader';

@Component({components: {LoadingSpinner}})
export default class App extends Vue {
    @State('isRequestLoaded') private isRequestLoaded!: boolean;

    public async created() {
        await this.$store.dispatch('initWallets');
        this.$rpc.start();
        await loadBitcoinJS();
    }

    private get isLoaded() {
        return this.isRequestLoaded
            || this.$route.name === REQUEST_ERROR;
    }
}
</script>

<style>
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
        margin-bottom: 9.5rem; /* Same height as the header (2 * 3rem + 3.5rem) */
    }

    /* transition-fade */
    .transition-fade-enter,
    .transition-fade-leave-to {
        opacity: 0;
    }

    /* transition-flip: Note that position: relative and a perspective needs to be applied to the parent */
    .transition-flip-enter-active,
    .transition-flip-leave-active {
        --safari-rotate-fix: translateZ(1px);
        transition: transform .6s;
        transform-style: preserve-3d;
        backface-visibility: hidden;
    }

    .transition-flip-leave-active {
        position: absolute !important;
        top: 0;
        left: 0;
    }

    .transition-flip-enter-to,
    .transition-flip-leave {
        transform: rotateY(0) var(--safari-rotate-fix);
    }

    .transition-flip-enter.flip-primary,
    .transition-flip-leave-to.flip-primary {
        transform: rotateY(-180deg) var(--safari-rotate-fix);
    }

    .transition-flip-enter.flip-secondary,
    .transition-flip-leave-to.flip-secondary {
        transform: rotateY(180deg) var(--safari-rotate-fix);
    }

    .nq-button {
        height: 6.5rem;
    }

    @media (max-width: 450px) {
        #app > .container {
            margin-bottom: 0 !important;
            justify-content: flex-end;
        }

        .nq-card {
            margin: 0;
            border-bottom-left-radius: 0;
            border-bottom-right-radius: 0;
        }
    }
</style>
