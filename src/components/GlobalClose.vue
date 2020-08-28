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
        return this.buttonLabel || this.$t('Back to {appName}', { appName: this.request.appName });
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
