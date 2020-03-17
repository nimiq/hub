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

@Component({components: {LoadingSpinner}})
export default class App extends Vue {
    @State('isRequestLoaded') private isRequestLoaded!: boolean;

    public async created() {
        await this.$store.dispatch('initWallets');
        this.$rpc.start();
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

    .global-close {
        margin-top: 8rem;
        margin-bottom: 3rem;
        background: transparent !important;
        opacity: 0.4;
        font-size: 2rem;
        transition: color .3s cubic-bezier(0.25, 0, 0, 1), opacity .3s cubic-bezier(0.25, 0, 0, 1);
    }

    .global-close:hover,
    .global-close:focus {
        color: var(--nimiq-light-blue);
        opacity: 1;
    }

    .global-close .nq-icon {
        vertical-align: top;
        width: 1.375rem;
        height: 1.125rem;
        margin-right: 0.25rem;
        margin-top: 1.125rem;
        transition: transform .3s cubic-bezier(0.25, 0, 0, 1);
    }

    .global-close:hover .nq-icon,
    .global-close:focus .nq-icon {
        transform: translate3D(-0.25rem, 0, 0);
    }

    .global-close.hidden {
        visibility: hidden;
        pointer-events: none;
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

    /* Mobile Layout */
    @media (max-width: 400px) {
        .global-close > span {
            display: none;
        }
    }

    @media (max-width: 450px) {
        #app > .container {
            margin-bottom: 0 !important;
            justify-content: flex-end;
        }

        .global-close {
            position: absolute;
            right: 1rem;
            top: 2.4rem;
            margin: 0;
        }

        .global-close::before {
            /* avoid that the button overflows the page, causing vertical scrolling on mobile */
            right: -1rem;
        }

        .nq-card {
            margin: 0;
            border-bottom-left-radius: 0;
            border-bottom-right-radius: 0;
        }
    }
</style>
