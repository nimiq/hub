<template>
    <button class="global-close nq-button-s" :class="{ hidden }" @click="effectiveCloseHandler">
        <ArrowLeftSmallIcon/>
        {{ effectiveButtonLabel }}
    </button>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';
import { ArrowLeftSmallIcon } from '@nimiq/vue-components';
import { ERROR_CANCELED } from '../lib/Constants';
import { Static } from '../lib/StaticStore';
import { ParsedBasicRequest } from '../lib/RequestTypes';

@Component({ components: { ArrowLeftSmallIcon }})
export default class GlobalClose extends Vue {
    @Prop(String) public buttonLabel?: string;

    @Prop(Function) public onClose?: () => void;

    @Prop(Boolean) public hidden?: boolean;

    @Static private request!: ParsedBasicRequest;

    private get effectiveButtonLabel() {
        if (this.buttonLabel) return this.buttonLabel;
        // Special handling for some specific known app names to be able to adapt translations depending on the app,
        // for example to adapt to an app's gender in a language (e.g. German: "Zurück zur Wallet", "Zurück zum Miner").
        // Note that the app names that should not be translated are specified as a slot.
        const appName = this.request.appName;
        switch (appName) {
            case 'Accounts': return this.$t('Back to my accounts'); // Nimiq Safe
            case 'Wallet': return this.$t('Back to {Wallet}', { Wallet: appName });
            case 'Nimiq Miner': return this.$t('Back to {Nimiq Miner}', { 'Nimiq Miner': appName });
            case 'Nimiq Faucet': return this.$t('Back to {Nimiq Faucet}', { 'Nimiq Faucet': appName });
            case 'Donation Button Creator': return this.$t('Back to Donation Button Creator');
            case 'Nimiq Gift Card': return this.$t('Back to Nimiq Gift Card');
            case 'Nimiq Vote': return this.$t('Back to Nimiq Vote');
            case 'CryptoPayment.link': return this.$t('Back to CryptoPayment.link');
            default: return this.$t('Back to {appName}', { appName });
        }
    }

    private get effectiveCloseHandler() {
        return !this.hidden
            ? this.onClose || (() => this.$rpc.reject(new Error(ERROR_CANCELED)))
            : () => void 0;
    }
}
</script>

<style scoped>
    .global-close {
        margin-top: 8rem;
        margin-bottom: 3rem;
        background: transparent !important;
        opacity: 0.4;
        font-size: 2rem;
        transition: color .3s var(--nimiq-ease), opacity .3s var(--nimiq-ease), visibility .3s;
    }

    .global-close:hover,
    .global-close:focus {
        color: var(--nimiq-light-blue);
        opacity: 1;
    }

    .global-close.hidden {
        visibility: hidden;
        pointer-events: none;
        opacity: 0;
    }

    .nq-icon {
        vertical-align: top;
        width: 1.375rem;
        height: 1.125rem;
        margin-right: 0.25rem;
        margin-top: 1.125rem;
        transition: transform .3s var(--nimiq-ease);
    }

    .global-close:hover .nq-icon,
    .global-close:focus .nq-icon {
        transform: translate3D(-0.25rem, 0, 0);
    }

    @media (max-width: 450px) {
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
    }
</style>
