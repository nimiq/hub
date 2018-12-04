<template>
    <div class="identicon-selector" :class="{ selected: !!selectedAccount }">
        <div class="identicons">
            <div class="center" v-if="displayedAccounts.length === 0">
                <div class="loading-animation"></div>
                <h2>Mixing colors</h2>
            </div>
            <div class="wrapper" @click="selectedAccount = account"
                 :class="{ selected: selectedAccount === account }" v-for="account in displayedAccounts">
                <Identicon :address="account.userFriendlyAddress"></Identicon>
                <div class="address">{{ account.userFriendlyAddress }}</div>
            </div>
        </div>
        <button @click="page += 1" v-if="displayedAccounts.length > 0" class="generate-more nq-button-s">
            Show more
        </button>

        <div @click="selectedAccount = null" class="backdrop">
            <button @click="_onSelectionConfirmed" class="nq-button inverse">Select</button>
            <a tabindex="0" class="nq-text-s nq-link">Back</a>
        </div>
    </div>
</template>

<script lang="ts">
    import { Component, Prop, Watch, Vue } from 'vue-property-decorator';
    import { Identicon } from '@nimiq/vue-components';
    import { AccountInfo } from '../lib/AccountInfo';

    @Component({components: { Identicon }})
    class IdenticonSelector extends Vue {
        private static readonly IDENTICONS_PER_PAGE = 7;

        @Prop({ default: () => [], type: Array })
        public accounts!: AccountInfo[];

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

        @Watch('displayedAccounts')
        private _onDisplayedAccountsChanged() {
            // retrigger pop-in animation
            const identicons  = this.$el.querySelectorAll('.identicon');
            identicons.forEach((identicon: Element) => (identicon as HTMLElement).style.animationName = 'non-existent');
            this.$el.offsetWidth; // tslint:disable-line:no-unused-expression
            identicons.forEach((identicon: Element) => (identicon as HTMLElement).style.animationName = null); // reset
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
        padding: 4rem;
        overflow: hidden;
    }

    .identicon-selector .loading-animation {
        margin: auto;
    }

    .identicon-selector .wrapper {
        width: 14.25rem;
        height: 14.25rem;
        position: absolute;
        z-index: 1;
        will-change: transform;
        transition: transform .5s, z-index 0s;
        /* use a delay for z-index to keep it above other identicons when transitioning back to initial position */
        transition-delay: 0s, .5s;
        -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
        cursor: pointer;
    }

    .identicon-selector .wrapper .identicon {
        width: 100%;
        height: 100%;
        animation: pop-in 500ms ease;
        animation-fill-mode: backwards;
    }

    .identicon-selector .wrapper .address {
        visibility: hidden;
        text-align: center;
        font-size: 1.75rem;
        transform: scale(0.5);
        margin-top: 3rem;
        color: white;
    }

    @keyframes pop-in {
        from { transform: scale(0); }
        to   { transform: scale(1); }
    }

    .identicon-selector .wrapper .identicon img,
    .identicon-selector .wrapper .address {
        transition: transform 500ms;
    }

    .identicon-selector .identicons {
        display: flex;
        flex-grow: 1;
        justify-content: center;
        align-items: center;
        width: 100%;
        height: 41rem;
        position: relative;
    }

    .identicon-selector .wrapper:nth-child(1) { transform: translate(  0.0rem, -14.25rem); }
    .identicon-selector .wrapper:nth-child(2) { transform: translate(-12.5rem,  -7.25rem); }
    .identicon-selector .wrapper:nth-child(3) { transform: translate( 12.5rem,  -7.25rem); }
    .identicon-selector .wrapper:nth-child(4) { transform: translate(  0.0rem,   0.00rem); }
    .identicon-selector .wrapper:nth-child(5) { transform: translate(-12.5rem,   7.25rem); }
    .identicon-selector .wrapper:nth-child(6) { transform: translate( 12.5rem,   7.25rem); }
    .identicon-selector .wrapper:nth-child(7) { transform: translate(  0.0rem,  14.25rem); }

    .identicon-selector .wrapper:nth-child(1) .identicon { animation-delay: 100ms; }
    .identicon-selector .wrapper:nth-child(2) .identicon { animation-delay: 150ms; }
    .identicon-selector .wrapper:nth-child(3) .identicon { animation-delay: 150ms; }
    .identicon-selector .wrapper:nth-child(4) .identicon { animation-delay: 200ms; }
    .identicon-selector .wrapper:nth-child(5) .identicon { animation-delay: 250ms; }
    .identicon-selector .wrapper:nth-child(6) .identicon { animation-delay: 250ms; }
    .identicon-selector .wrapper:nth-child(7) .identicon { animation-delay: 300ms; }


    .identicon-selector .generate-more {
        margin-top: 3rem;
    }

    .identicon-selector .backdrop {
        position: absolute;
        top: 0;
        left: 0;
        background: rgba(0, 0, 0, 0.85);
        z-index: 1;
        pointer-events: none;
        opacity: 0;
        transition: opacity 500ms;
        will-change: opacity;
        height: 100%;
        width: 100%;
        display: flex;
        flex-flow: column;
        align-items: center;
    }

    .identicon-selector .backdrop button {
        opacity: 0;
        position: absolute;
        bottom: 6rem;
        pointer-events: none;
        margin: 0;
    }

    .identicon-selector .backdrop .nq-link {
        color: white;
        position: absolute;
        margin-bottom: 2rem;
        bottom: 0;
        cursor: pointer;
    }

    .identicon-selector.selected .backdrop,
    .identicon-selector.selected .backdrop button {
        opacity: 1;
        pointer-events: all;
    }

    .identicon-selector .wrapper.selected {
        z-index: 2;
        transform: translateY(-5rem);
        transition-delay: 0s;
        width: 100%;
        pointer-events: none;
    }

    .identicon-selector .wrapper.selected img {
        transform: scale(1.5);
    }

    .identicon-selector .wrapper.selected .address {
        visibility: visible;
        transform: scale(1);
    }
</style>
