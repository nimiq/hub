<template>
    <div id="app">
        <header class="logo-container">
            <div class="logo icon-logo">
                Nimiq
            </div>
        </header>
        <router-view/>
    </div>
</template>

<script lang="ts">
    import {Vue} from 'vue-property-decorator';
    import Component from "vue-class-component";

    @Component({})
    export default class App extends Vue {
        created() {
            this.$store.dispatch('initKeys');
        }
    }
</script>

<style>
    @import '../node_modules/@nimiq/vue-components/dist/vue-components.css';

    html, body {
        --logo-height: 60px;
        --logo-width: 64px;
        margin: 0;
        height: 100%;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", Helvetica, Arial, sans-serif;
    }

    html {
        background: linear-gradient(30deg, #3023AE, #9C58CB);
        background-size: cover;
        background-attachment: fixed;
    }

    .logo {
        --logo-padding: 16px;
        height: var(--logo-height);
        box-sizing: border-box;
        padding: 16px;
        padding-left: var(--logo-width);
        background-size: 34px 30px;
        background-position: 16px;
        font-size: 17px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 1px;
        display: inline-flex;
        align-items: center;
        color: white;
        z-index: 1;
        text-decoration: none;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
        outline: none !important;
        background-repeat: no-repeat;
        background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="499" height="440"><path fill="%23FFC107" fill-rule="evenodd" d="M389 21c-6-12-23-21-36-21H145c-13 0-29 9-36 21L5 199c-6 11-6 30 0 41l104 178c7 12 23 21 36 21h208c14 0 30-9 36-21l104-178c7-11 7-30 0-41L389 21zM273 347v42h-39v-40c-24-3-52-13-70-30l25-39c21 15 38 23 57 23 23 0 33-9 33-28 0-40-106-39-106-111 0-38 23-65 61-73V51h39v40c25 3 44 16 59 32l-29 33c-15-13-27-20-44-20-19 0-29 8-29 26 0 37 105 34 105 110 0 37-21 67-62 75z"/></svg>');
    }

    #app {
        height: 100%;
        display: flex;
        flex-direction: column;
    }

    @media (max-width: 490px) {

    }
</style>
