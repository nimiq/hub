<template>
    <div id="app">
        <header class="logo-container">
            <div class="logo icon-logo">
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

@Component
export default class App extends Vue {
    @State('hasRpcState') private hasRpcState!: boolean;
    @State('hasRequest') private hasRequest!: boolean;

    private isRequestLoaded = false;

    public created() {
        this.$store.dispatch('initKeys');
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
    @import '../node_modules/@nimiq/vue-components/dist/NimiqVueComponents.css';

    html, body {
        margin: 0;
        height: 100%;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", Helvetica, Arial, sans-serif;
    }

    html {
        background: linear-gradient(55deg, #2462dc, #a83df6);
        background-size: cover;
        background-attachment: fixed;
        font-size: 8px;
        --nimiq-size: 8px; /* For @nimiq/vue-components */
    }

    @media (max-width: 450px) {
        html {
            font-size: 7px;
            --nimiq-size: 7px; /* For @nimiq/vue-components */
        }
    }

    body {
        font-size: 2.25rem;
    }

    .logo-container {
        width: 100%;
        padding: 4rem;
        box-sizing: border-box;
    }

    .logo {
        height: 3.625rem;
        box-sizing: border-box;
        padding-left: 6rem;
        font-size: 2.125rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.077em;
        display: inline-flex;
        align-items: center;
        color: white;
        z-index: 1;
        text-decoration: none;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
        outline: none !important;
        background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="499" height="440"><path fill="%23FFC107" fill-rule="evenodd" d="M389 21c-6-12-23-21-36-21H145c-13 0-29 9-36 21L5 199c-6 11-6 30 0 41l104 178c7 12 23 21 36 21h208c14 0 30-9 36-21l104-178c7-11 7-30 0-41L389 21zM273 347v42h-39v-40c-24-3-52-13-70-30l25-39c21 15 38 23 57 23 23 0 33-9 33-28 0-40-106-39-106-111 0-38 23-65 61-73V51h39v40c25 3 44 16 59 32l-29 33c-15-13-27-20-44-20-19 0-29 8-29 26 0 37 105 34 105 110 0 37-21 67-62 75z"/></svg>');
        background-repeat: no-repeat;
        background-size: 4.125rem 3.625rem;
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
        display: inline-block;
        height: 3.5rem;
        border-radius: 1.75rem;
        background-color: rgba(0, 0, 0, 0.1);
        font-size: 1.75rem;
        font-weight: 600;
        line-height: 3.375rem;
        color: white;
        padding: 0 1.5rem;
        cursor: pointer;
        margin-top: 8rem;
        margin-bottom: 5rem;
    }

    .global-close::before {
        content: '';
        display: inline-block;
        height: 1.375rem;
        width: 1.375rem;
        background-image: url('data:image/svg+xml,<svg height="24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M0 0h24v24H0z" fill="none"/><path fill="%23fff" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>');
        background-repeat: no-repeat;
        background-size: 2rem;
        background-position: center;
        margin-right: 1rem;
        margin-bottom: -0.125rem;
    }

    .global-close.hidden {
        visibility: hidden;
        pointer-events: none;
    }

    /****************
    ** Nimiq Style **
    ****************/

    /* buttons */

    button::-moz-focus-inner {
        border: 0;
    }

    button,
    [button] {
        font-size: 2rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.094em;
        width: 100%;
        height: 8rem;
        max-width: 41rem;
        border-radius: 4rem;
        padding: 0 4rem;
        vertical-align: middle;
        display: table-cell;
        text-align: center;
        background: white;
        color: var(--main-button-color);
        cursor: pointer;
        user-select: none;
        box-shadow: 0 1.25rem 1.75rem 0 rgba(0, 0, 0, 0.15);
        border: none;
        outline: none;
        line-height: 1.25;
        font-family: inherit;
        box-sizing: border-box;
    }

    button[disabled],
    [button][disabled] {
        opacity: 0.6;
        pointer-events: none;
    }
</style>
