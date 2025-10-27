<template>
    <div id="app">
        <header class="logo">
            <span class="nq-icon nimiq-logo"></span>
            <span class="logo-wordmark">Nimiq</span>
            <span class="logo-subtitle">USDT Cashlink</span>
            <div class="flex-grow"></div>
            <a class="nq-button-s" href="https://nimiq.com" target="_blank">
                {{ $t('What is Nimiq?') }}
            </a>
        </header>
        <div v-if="loading" class="loading">
            <LoadingSpinner/>
        </div>
        <UsdtCashlinkReceive v-else @theme-change="_onThemeChange"/>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { LoadingSpinner } from '@nimiq/vue-components';
import UsdtCashlinkReceive from './views/UsdtCashlinkReceive.vue';
import { CashlinkTheme } from '../client/PublicRequestTypes';

import '@nimiq/style/nimiq-style.min.css';
import '@nimiq/vue-components/dist/NimiqVueComponents.css';

@Component({components: {LoadingSpinner, UsdtCashlinkReceive}})
export default class UsdtCashlinkApp extends Vue {
    private loading = true;
    private isDarkTheme = false;

    public async created() {
        await this.$store.dispatch('initWallets');
        this.loading = false;
    }

    private _onThemeChange(theme: CashlinkTheme, isDarkTheme: boolean) {
        this.isDarkTheme = isDarkTheme;
    }
}
</script>

<style>
    header .nq-button-s {
        line-height: 3.375rem;
    }

    header {
        transition: color .3s var(--nimiq-ease);
    }

    .dark-theme header {
        color: white;
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
        margin-bottom: 9.5rem;
    }

    .transition-fade-enter,
    .transition-fade-leave-to {
        opacity: 0;
    }

    .flex-grow {
        flex-grow: 1;
    }

    /* Mobile Layout */

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

    @media (max-width: 374px) {
        .logo-subtitle {
            display: none;
        }
    }
</style>

