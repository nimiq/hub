<template>
    <SmallPage class="onboarding-menu" :class="{ 'has-three-line-text': hasThreeLineText }">
        <button class="choice ledger" tabindex="3" @click="ledger">
            <LedgerIcon/>
            <h2 class="nq-h2">{{ $t('Connect Ledger') }}</h2>
            <p class="text">{{ $t('Connect your Ledger Nano\u00a0S or Nano\u00a0X.') }}</p>
        </button>

        <button class="choice login" tabindex="2" @click="login">
            <LoginIcon/>
            <h2 class="nq-h2">{{ $t('Login') }}</h2>
            <p class="text">{{ $t('Use your Login File\nor Recovery Words.') }}</p>
        </button>

        <button class="choice signup" tabindex="1" @click="signup">
            <PlusCircleIcon/>
            <h2 class="nq-h2">{{ $t('Create Account') }}</h2>
            <p class="text">{{ $t('Choose an Avatar.\nSet a password. Done.') }}</p>
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
import { SmallPage, LedgerIcon, PlusCircleIcon, LoginIcon } from '@nimiq/vue-components';

@Component({components: {SmallPage, LedgerIcon, PlusCircleIcon, LoginIcon}})
export default class AccountList extends Vue {
    private hasThreeLineText: boolean = false;

    private mounted() {
        this.hasThreeLineText = [...this.$el.querySelectorAll('.text')].some((text) => {
            return (text as HTMLElement).offsetHeight > 50; // note that this works independent of zoom level
        });
    }

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
        width: 89rem;
        height: auto;
        padding: 0.75rem;
        position: relative;
        display: flex;
        flex-direction: row-reverse;
        justify-content: space-between;
        z-index: 0;
        overflow: hidden;
    }

    .choice {
        display: flex;
        flex-direction: column;
        width: 33.33%;
        padding: 4rem 4rem 3.75rem;
        background: none;
        border: none;
        outline: none;
        font-size: inherit;
        font-family: inherit;
        transition: color 450ms cubic-bezier(0.25, 0, 0, 1);
        cursor: pointer;
        text-align: left;
        z-index: 200;
        position: relative;
    }

    .has-three-line-text .choice {
        min-height: 27rem;
        padding: 3rem 3rem 2rem; /* by reduced padding the 3 line text might become 2 lines but that still looks ok */
    }

    .choice.login:hover ~ .choice.signup,
    .choice.login:focus ~ .choice.signup,
    .choice.ledger:hover ~ .choice.signup,
    .choice.ledger:focus ~ .choice.signup {
        color: inherit;
    }

    .choice svg,
    .choice.login:hover ~ .choice.signup svg,
    .choice.login:focus ~ .choice.signup svg,
    .choice.ledger:hover ~ .choice.signup svg,
    .choice.ledger:focus ~ .choice.signup svg {
        font-size: 6.75rem;
        color: rgba(31, 35, 72, 0.2); /* based on Nimiq Blue */
        transition: color 450ms cubic-bezier(0.25, 0, 0, 1);
    }

    .choice.ledger svg {
        height: 6.75rem;
        width: unset;
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
        transition: opacity 450ms cubic-bezier(0.25, 0, 0, 1);
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
        white-space: pre-line;
    }

    .background-container {
        position: absolute;
        left: 0.75rem;
        top: 0.75rem;
        transform: translate3d(0, 0, 0);
        transition: transform 450ms cubic-bezier(0.25, 0, 0, 1);
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
        transition: opacity 300ms cubic-bezier(0.25, 0, 0, 1);
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

        .choice {
            width: 100%;
            height: 33%;
            min-height: unset !important;
            padding: 3.25rem 3rem !important;
            justify-content: center;
        }

        .choice h2 {
            margin-top: -.25rem;
        }

        .choice .text {
            max-width: 23rem;
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
