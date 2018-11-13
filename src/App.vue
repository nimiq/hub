<template>
    <div id="app">
        <header class="logo-container">
            <div class="logo icon-logo">
                <span class="nq-icon nimiq-logo"></span>
                Nimiq
            </div>
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

    .logo-container {
        width: 100%;
        padding: 4rem;
        box-sizing: border-box;
    }

    .logo {
        height: 3.625rem;
        box-sizing: border-box;
        /* padding-left: 6rem; */
        font-size: 2.125rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.077em;
        display: inline-flex;
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
        margin-right: 2rem;
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
        background-image: url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCIgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0Ij48c3R5bGU+QGtleWZyYW1lcyBkYXNoLWFuaW1hdGlvbiB7IHRvIHsgdHJhbnNmb3JtOiByb3RhdGUoMjQwZGVnKSB0cmFuc2xhdGVaKDApOyB9IH0gI2NpcmNsZSB7IGFuaW1hdGlvbjogM3MgZGFzaC1hbmltYXRpb24gaW5maW5pdGUgbGluZWFyOyB0cmFuc2Zvcm06IHJvdGF0ZSgtMTIwZGVnKSB0cmFuc2xhdGVaKDApOyB0cmFuc2Zvcm0tb3JpZ2luOiBjZW50ZXI7IH08L3N0eWxlPjxkZWZzPjxjbGlwUGF0aCBpZD0iaGV4Q2xpcCI+PHBhdGggY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNMTYgNC4yOWgzMkw2NCAzMiA0OCA1OS43MUgxNkwwIDMyem00LjYyIDhoMjIuNzZMNTQuNzYgMzIgNDMuMzggNTEuNzFIMjAuNjJMOS4yNCAzMnoiLz48L2NsaXBQYXRoPjwvZGVmcz48cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xNiA0LjI5aDMyTDY0IDMyIDQ4IDU5LjcxSDE2TDAgMzJ6bTQuNjIgOGgyMi43Nkw1NC43NiAzMiA0My4zOCA1MS43MUgyMC42Mkw5LjI0IDMyeiIgZmlsbD0iI2ZmZiIgb3BhY2l0eT0iLjIiLz48ZyBjbGlwLXBhdGg9InVybCgjaGV4Q2xpcCkiPjxjaXJjbGUgaWQ9ImNpcmNsZSIgY3g9IjMyIiBjeT0iMzIiIHI9IjE2IiBmaWxsPSJub25lIiBzdHJva2Utd2lkdGg9IjMyIiBzdHJva2U9IiNGNkFFMkQiIHN0cm9rZS1kYXNoYXJyYXk9IjE2LjY2NiA4NC42NjYiLz48L2c+PC9zdmc+');
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
        color: white;
        text-transform: uppercase;
        font-size: 1.75rem;
        font-weight: 600;
        line-height: 0.86;
        letter-spacing: 0.143em;
    }

    .container {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
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
