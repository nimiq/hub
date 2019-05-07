<template>
    <SmallPage class="onboarding-menu">
        <button class="choice ledger" tabindex="3" @click="ledger">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 290 61" fill="currentColor"><path d="M145.5,46C137,46,130,39,130,30.5S137,15,145.5,15S161,22,161,30.5S154,46,145.5,46z M145.5,17 c-7.4,0-13.5,6.1-13.5,13.5S138.1,44,145.5,44S159,37.9,159,30.5S152.9,17,145.5,17z"/><path d="M285.5,3H107V2c0-1.1-0.9-2-2-2H89c-1.1,0-2,0.9-2,2v1H41V2c0-1.1-0.9-2-2-2H23c-1.1,0-2,0.9-2,2v1H4 C1.8,3,0,4.8,0,7v47c0,2.2,1.8,4,4,4h281.5c2.5,0,4.5-2,4.5-4.5v-46C290,5,288,3,285.5,3z M102,40.9c0,1.1-0.9,2.1-2,2.1H28 c-1.1,0-2-0.9-2-2.1V20.1c0-1.1,0.9-2.1,2-2.1h72c1.1,0,2,0.9,2,2.1V40.9z M288,53.5c0,1.4-1.1,2.5-2.5,2.5h-140 C131.4,56,120,44.6,120,30.5C120,16.4,131.4,5,145.5,5h140c1.4,0,2.5,1.1,2.5,2.5V53.5z"/></svg>
            <h2 class="nq-h2">Connect Ledger</h2>
            <p class="text">Connect your<br>Ledger Nano S.</p>
        </button>

        <button class="choice login" tabindex="2" @click="login">
            <svg width="54" height="54" viewBox="0 0 54 54" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M26.9504 9.82363e-05C13.7962 -0.0526329 2.51148 9.36619 0.211419 22.3178C0.15747 22.6463 0.251723 22.9818 0.46883 23.234C0.685938 23.4863 1.00361 23.6295 1.33642 23.6251H20.0564C20.6777 23.6251 21.1814 23.1214 21.1814 22.5001V14.4001C21.1811 13.5349 21.6769 12.7461 22.4568 12.3713C23.2366 11.9965 24.1623 12.1021 24.8377 12.6428L40.5877 25.2428C41.1216 25.6698 41.4325 26.3164 41.4325 27.0001C41.4325 27.6838 41.1216 28.3304 40.5877 28.7573L24.8377 41.3573C24.4385 41.6766 23.9425 41.8503 23.4314 41.8501C22.1934 41.8391 21.1924 40.8382 21.1814 39.6001V31.5001C21.1814 30.8788 20.6777 30.3751 20.0564 30.3751H1.34992C1.01776 30.3752 0.702193 30.5203 0.485955 30.7724C0.269717 31.0246 0.174372 31.3586 0.224919 31.6868C2.74947 45.6226 15.6128 55.2393 29.6934 53.7177C43.774 52.196 54.2859 40.0532 53.7749 25.8998C53.0621 11.5438 41.3227 0.20906 26.9504 9.82363e-05Z"/></svg>
            <h2 class="nq-h2">Login</h2>
            <p class="text">Use your Login File<br>or Recovery Words.</p>
        </button>

        <button class="choice signup" tabindex="1" @click="signup">
            <svg width="54" height="54" viewBox="0 0 54 54" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M27 54C41.9117 54 54 41.9117 54 27C54 12.0883 41.9117 0 27 0C12.0883 0 0 12.0883 0 27C0 41.9117 12.0883 54 27 54ZM29.5 14C30.0523 14 30.5 14.4477 30.5 15V23.5H39C39.5523 23.5 40 23.9477 40 24.5V29.5C40 30.0523 39.5523 30.5 39 30.5H30.5V39C30.5 39.5523 30.0523 40 29.5 40H24.5C23.9477 40 23.5 39.5523 23.5 39V30.5H15C14.4477 30.5 14 30.0523 14 29.5V24.5C14 23.9477 14.4477 23.5 15 23.5H23.5V15C23.5 14.4477 23.9477 14 24.5 14H29.5Z"/></svg>
            <h2 class="nq-h2">Create Account</h2>
            <p class="text">Choose an Avatar.<br>Set a password. Done.</p>
        </button>

        <div class="background-container">
            <div class="background signup nq-green-bg"></div>
            <div class="background login nq-light-blue-bg"></div>
            <div class="background ledger nq-blue-bg"></div>
        </div>
    </SmallPage>
</template>

<script lang="ts">
import { Component, Emit, Vue } from 'vue-property-decorator';
import { SmallPage } from '@nimiq/vue-components';

@Component({components: {SmallPage}})
export default class AccountList extends Vue {
    @Emit()
    // tslint:disable-next-line:no-empty
    private signup() {}

    @Emit()
    // tslint:disable-next-line:no-empty
    private login() {}

    @Emit()
    // tslint:disable-next-line:no-empty
    private ledger() {}
}
</script>

<style scoped>
    .onboarding-menu {
        max-width: unset;
        min-height: unset;
        width: 88rem;
        height: 29rem;
        padding: 0.75rem;
        position: relative;
        display: flex;
        flex-direction: row-reverse;
        justify-content: space-between;
        z-index: 0;
        overflow: hidden;
    }

    .choice,
    .choice.login:hover ~ .choice.signup,
    .choice.login:focus ~ .choice.signup,
    .choice.ledger:hover ~ .choice.signup,
    .choice.ledger:focus ~ .choice.signup {
        width: 33.33%;
        height: 100%;
        background: none;
        border: none;
        outline: none;
        font-size: inherit;
        font-family: inherit;
        padding: 4rem;
        transition: color 500ms;
        cursor: pointer;
        text-align: left;
        z-index: 200;
        position: relative;
        color: inherit;
    }

    .choice svg,
    .choice.login:hover ~ .choice.signup svg,
    .choice.login:focus ~ .choice.signup svg,
    .choice.ledger:hover ~ .choice.signup svg,
    .choice.ledger:focus ~ .choice.signup svg {
        height: 6.75rem;
        color: rgba(31, 35, 72, 0.2); /* based on Nimiq Blue */
        transition: color 500ms;
    }

    .choice.signup,
    .choice:hover,
    .choice:focus {
        color: white;
    }

    .choice.signup svg,
    .choice:hover svg,
    .choice:focus svg {
        color: white;
    }

    .choice.signup::after,
    .choice.login::after,
    .choice.ledger:hover ~ .choice.signup::after,
    .choice.ledger:focus ~ .choice.signup::after {
        content: '';
        display: block;
        position: absolute;
        right: -0.125rem;
        top: 2rem;
        width: 0.25rem;
        border-radius: 0.25rem;
        height: calc(100% - 4rem);
        background: var(--nimiq-blue);
        opacity: 0.1;
        transition: opacity 500ms;
    }

    .choice.signup::after,
    .choice.login:hover::after,
    .choice.login:focus::after,
    .choice.ledger:hover ~ .choice.login::after,
    .choice.ledger:focus ~ .choice.login::after {
        opacity: 0;
    }

    .nq-h2 {
        margin-top: 4.25rem;
        margin-bottom: 1.25rem;
    }

    .text {
        font-size: 2rem;
        line-height: 1.3125;
        margin: 0;
    }

    .background-container {
        position: absolute;
        left: 0.75rem;
        top: 0.75rem;
        transform: translate3d(0, 0, 0);
        transition: transform .4s ease;
        z-index: 100;
        width: calc((100% - 1.5rem) / 3);
        height: calc(100% - 1.5rem);
    }

    .background {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        border-radius: 0.5rem;
        transition: opacity 500ms;
    }

    .background.login,
    .background.ledger {
        opacity: 0;
    }

    .choice.login:hover ~ .background-container,
    .choice.login:focus ~ .background-container {
        transform: translate3d(100%, 0, 0);
    }

    .choice.ledger:hover ~ .background-container,
    .choice.ledger:focus ~ .background-container {
        transform: translate3d(200%, 0, 0);
    }

    .choice.login:hover ~ .background-container .background.login,
    .choice.login:focus ~ .background-container .background.login {
        opacity: 1;
    }

    .choice.ledger:hover ~ .background-container .background.ledger,
    .choice.ledger:focus ~ .background-container .background.ledger {
        opacity: 1;
    }

    @media (max-width: 750px) {
        /* make the menu a column */
        .onboarding-menu {
            margin: 0;
            width: 100%;
            height: 50rem;
            flex-direction: column-reverse;
        }

        .choice,
        .choice.login:hover ~ .choice.signup,
        .choice.login:focus ~ .choice.signup,
        .choice.ledger:hover ~ .choice.signup,
        .choice.ledger:focus ~ .choice.signup {
            width: 100%;
            height: 33%;
            padding: 3.5rem 3rem;
        }

        .choice h2 {
            margin-top: 0;
        }

        .choice svg {
            position: absolute;
            top: 50%;
            /* combination of right and transform, that renders signup and login SVGs at 32px margin
            (80% * svg width - right = -32px) and ledger at a nice looking position */
            right: 9.4rem;
            transform: translateY(-50%) translateX(80%);
        }

        .choice.signup::after,
        .choice.login::after,
        .choice.ledger:hover ~ .choice.signup::after,
        .choice.ledger:focus ~ .choice.signup::after {
            top: unset;
            right: unset;
            bottom: -0.125rem;
            left: 2rem;
            height: 0.25rem;
            border-radius: 0.25rem;
            width: calc(100% - 4rem);
        }

        .background-container {
            width: calc(100% - 1.5rem);
            height: calc((100% - 1.5rem) / 3);
        }

        .choice.login:hover ~ .background-container,
        .choice.login:focus ~ .background-container {
            transform: translate3d(0, 100%, 0);
        }

        .choice.ledger:hover ~ .background-container,
        .choice.ledger:focus ~ .background-container {
            transform: translate3d(0, 200%, 0);
        }
    }
</style>
