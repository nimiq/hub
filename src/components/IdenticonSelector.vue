<template>
    <div class="identicon-selector" :class="{ 'account-details-shown': selectedAccount && confirmAccountSelection }"
        @keydown.esc="_selectAccount(null)">
        <div class="blur-target">
            <slot name="header">
                <PageHeader>Choose an Avatar</PageHeader>
            </slot>
        </div>
        <div class="identicons">
            <div class="center blur-target" v-if="displayedAccounts.length === 0">
                <LoadingSpinner/>
                <h2 class="nq-h2">Mixing colors</h2>
            </div>
            <button class="wrapper" v-for="account in displayedAccounts" :key="account.userFriendlyAddress"
                @click="_selectAccount(account)"
                :class="{ selected: selectedAccount === account && confirmAccountSelection }"
                :tabindex="selectedAccount && confirmAccountSelection ? -1 : 0">
                <Identicon :address="account.userFriendlyAddress"></Identicon>
            </button>
        </div>
        <button @click="page += 1" v-if="displayedAccounts.length > 0"
            :tabindex="selectedAccount && confirmAccountSelection ? -1 : 0"
            class="generate-more nq-button-s blur-target">
            More Avatars
        </button>

        <transition name="transition-fade">
            <div v-if="selectedAccount && confirmAccountSelection" @click="_selectAccount(null)"
                class="account-details">
                <button @click="_selectAccount(null)" class="nq-button-s close-button">
                    <CloseIcon/>
                </button>
                <LabelInput :placeholder="selectedAccount.defaultLabel" :value="selectedAccount.label"
                            @changed="selectedAccount.label = $event || selectedAccount.defaultLabel"
                            @click.native.stop ref="labelInput"/>
                <AddressDisplay :address="selectedAccount.userFriendlyAddress" @click.native.stop/>
                <button @click.stop="_onSelectionConfirmed" class="nq-button light-blue">{{confirmButtonText}}</button>
            </div>
        </transition>
    </div>
</template>

<script lang="ts">
    import { Component, Prop, Watch, Vue } from 'vue-property-decorator';
    import { PageHeader, LoadingSpinner, Identicon, AddressDisplay, CloseIcon } from '@nimiq/vue-components';
    import { AccountInfo } from '@/lib/AccountInfo';
    import { default as LabelInput } from './Input.vue';
    import { isDesktop } from '../lib/Constants';

    @Component({components: { PageHeader, Identicon, LoadingSpinner, AddressDisplay, LabelInput, CloseIcon }})
    class IdenticonSelector extends Vue {
        private static readonly IDENTICONS_PER_PAGE = 7;

        @Prop({ default: () => [], type: Array })
        public accounts!: AccountInfo[];

        @Prop({ default: true, type: Boolean })
        public confirmAccountSelection!: boolean;

        @Prop({ default: 'Select', type: String })
        public confirmButtonText!: string;

        private page: number = 0;
        private selectedAccount: AccountInfo | null = null;

        private get displayedAccounts(): AccountInfo[] {
            if (this.accounts.length === 0) return [];
            const accountsToDisplay = [];
            let index = (this.page * IdenticonSelector.IDENTICONS_PER_PAGE) % this.accounts.length;
            while (accountsToDisplay.length < IdenticonSelector.IDENTICONS_PER_PAGE) {
                accountsToDisplay.push(this.accounts[index]);
                index = (index + 1) % this.accounts.length;
            }
            return accountsToDisplay;
        }

        @Watch('accounts')
        private _onAccountsChanged() {
            this.selectedAccount = null;
            this.page = 0;
        }

        private _selectAccount(account: AccountInfo | null) {
            this.selectedAccount = account;
            if (!account || this.confirmAccountSelection) {
                if (account && isDesktop()) {
                    Vue.nextTick().then(() => (this.$refs.labelInput as LabelInput).focus());
                }
                return;
            }
            this._onSelectionConfirmed();
        }

        private _onSelectionConfirmed() {
            this.$emit(IdenticonSelector.Events.IDENTICON_SELECTED, this.selectedAccount);
        }
    }

    namespace IdenticonSelector { // tslint:disable-line:no-namespace
        export const enum Events {
            IDENTICON_SELECTED = 'identicon-selected',
        }
    }

    export default IdenticonSelector;
</script>

<style scoped>
    .identicon-selector {
        width: 100%;
        text-align: center;
        position: relative;
        overflow: hidden;
        flex-grow: 1;
    }

    button:not(.nq-button):not(.nq-button-s) {
        background: unset;
        border: unset;
        font-family: unset;
        padding: unset;
        -webkit-appearance: none;
        -moz-appearance: none;
    }

    .identicons {
        display: flex;
        flex-grow: 1;
        justify-content: center;
        align-items: center;
        width: 100%;
        height: 41rem;
        position: relative;
        margin-top: 3rem;
    }

    .wrapper {
        width: 14.25rem;
        height: 14.25rem;
        position: absolute;
        z-index: 1;
        /* use a delay for z-index to only reset the value after transitioning back */
        transition: transform .5s 0s cubic-bezier(0.25, 0, 0, 1), filter .4s 0s cubic-bezier(0.25, 0, 0, 1), z-index 0s .5s;
        -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
        cursor: pointer;
        outline: none !important;
    }

    .wrapper .identicon {
        width: 100%;
        height: 100%;
        animation: pop-in 500ms cubic-bezier(0.25, 0, 0, 1);
        animation-fill-mode: backwards;
    }

    @keyframes pop-in {
        from { transform: scale(0); }
        to   { transform: scale(1); }
    }

    .wrapper .identicon >>> img {
        transition: transform .5s;
    }

    .wrapper:hover >>> img,
    .wrapper:focus >>> img {
        transform: scale(1.1);
    }

    .wrapper:nth-child(1) { transform: translate(  0.0rem, -14.25rem); }
    .wrapper:nth-child(2) { transform: translate(-12.5rem,  -7.25rem); }
    .wrapper:nth-child(3) { transform: translate( 12.5rem,  -7.25rem); }
    .wrapper:nth-child(4) { transform: translate(  0.0rem,   0.00rem); }
    .wrapper:nth-child(5) { transform: translate(-12.5rem,   7.25rem); }
    .wrapper:nth-child(6) { transform: translate( 12.5rem,   7.25rem); }
    .wrapper:nth-child(7) { transform: translate(  0.0rem,  14.25rem); }

    .wrapper:nth-child(1) .identicon { animation-delay: 100ms; }
    .wrapper:nth-child(2) .identicon { animation-delay: 150ms; }
    .wrapper:nth-child(3) .identicon { animation-delay: 150ms; }
    .wrapper:nth-child(4) .identicon { animation-delay: 200ms; }
    .wrapper:nth-child(5) .identicon { animation-delay: 250ms; }
    .wrapper:nth-child(6) .identicon { animation-delay: 250ms; }
    .wrapper:nth-child(7) .identicon { animation-delay: 300ms; }

    .wrapper.selected {
        z-index: 2;
        transform: translateY(-15rem);
        transition-delay: 0s;
        width: 100%;
        pointer-events: none;
    }

    .wrapper.selected >>> img {
        transform: scale(1.264) translateY(-1rem);
    }

    .generate-more {
        margin-top: 6rem;
    }

    .account-details {
        position: absolute;
        top: 0;
        left: 0;
        height: 100%;
        width: 100%;
        padding: 4rem 3rem;
        background: rgba(255, 255, 255, .875); /* equivalent to keyguard: .5 on blurred and .75 on account details */
        border-radius: 1rem;
        z-index: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;
        transition: opacity .5s cubic-bezier(0.25, 0, 0, 1);
    }

    .account-details .label-input {
        font-size: 3rem;
        font-weight: 600;
        max-width: 100%;
    }

    .account-details .address-display {
        margin-top: 2.5rem;
        user-select: all;
    }

    .account-details .nq-button {
        width: calc(100% - 6rem);
        margin: 5rem auto 0;
    }

    .account-details .close-button {
        position: absolute;
        right: 2rem;
        top: 2rem;
        font-size: 3rem;
        padding: 0;
        height: unset;
    }

    .account-details .close-button .nq-icon {
        opacity: .2;
        transition: opacity .3s cubic-bezier(0.25, 0, 0, 1);
    }

    .account-details .close-button .nq-icon:hover,
    .account-details .close-button .nq-icon:focus,
    .account-details .close-button .nq-icon:active {
        opacity: .4;
    }

    .blur-target {
        transition: filter .4s;
    }

    .blur-target.nq-button-s {
        transition: filter .4s,
            /* Transitions from @nimiq/style .nq-button-s class for proper hover/focus effect */
            color .3s cubic-bezier(.25, 0, 0, 1), background-color .3s cubic-bezier(.25, 0, 0, 1);
    }

    .account-details-shown .blur-target,
    .account-details-shown .wrapper:not(.selected) {
        filter: blur(20px);
    }
</style>
