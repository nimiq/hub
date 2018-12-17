<template>
    <div class="wallet-identifier">
        <div v-for="n in 6" class="account" :class="{ placeholder: n > accounts.length }">
            <Identicon :address="accounts[n - 1].userFriendlyAddress" v-if="n <= accounts.length"
                :class="{ 'pop-in': popIn }"></Identicon>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Prop, Watch, Vue } from 'vue-property-decorator';
import { Identicon } from '@nimiq/vue-components';
import { AccountInfo } from '../lib/AccountInfo';

@Component({components: { Identicon }})
export default class WalletIdentifier extends Vue {
    @Prop({ default: () => [], type: Array })
    public accounts!: AccountInfo[];

    @Prop({ default: false, type: Boolean })
    public animate!: boolean;

    private popIn: boolean = this.animate;

    @Watch('accounts')
    private async _onAccountsChanged() {
        if (!this.animate) return;
        // retrigger pop-in animation
        this.popIn = false;
        await this.$nextTick();
        requestAnimationFrame(() => this.popIn = true);
    }
}
</script>

<style scoped>
    .wallet-identifier {
        position: relative;
        --hex-width: 9rem;
        --hex-height: calc(var(--hex-width) * (49 / 58)); /* from placeholder viewBox="0 0 58 49" */
        --gap-x: calc(var(--hex-width) / 12);
        --gap-y: calc(var(--gap-x) * .9);
        min-height: calc(3 * var(--hex-height) + 2 * var(--gap-y));
        min-width: calc(2.5 * var(--hex-width) + 2 * var(--gap-x));
    }

    .wallet-identifier .account {
        width: var(--hex-width);
        height: var(--hex-height);
        position: absolute;
    }

    .wallet-identifier .account .identicon {
        width: 100%;
        height: 100%;
        transform: scale(1.15); /* to avoid that identicon appears smaller due to white border */
    }

    .wallet-identifier .placeholder {
        background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 58 49"><path fill="%231F2348" d="M56.8 22.2L45 2.7a4.8 4.8 0 0 0-4-2.3H17c-1.7 0-3.2.9-4 2.3L1 22.2a4.3 4.3 0 0 0 0 4.6L13 46.3a4.8 4.8 0 0 0 4.1 2.3h23.7c1.7 0 3.3-.9 4.1-2.3l11.9-19.5c.9-1.4.9-3.2 0-4.6z" opacity=".08"/></svg>') no-repeat;
    }

    .wallet-identifier .pop-in {
        animation: pop-in 0.5s cubic-bezier(.99,1.54,.49,1.15) backwards;
    }

    @keyframes pop-in {
        from { transform: scale(0); }
        to   { transform: scale(1.15); }
    }

    .wallet-identifier .account:nth-child(1) {
        left: calc(50% - 1.25 * var(--hex-width) - var(--gap-x));
        top: calc(50% - 1 * var(--hex-height) - 0.5 * var(--gap-y));
    }
    .wallet-identifier .account:nth-child(2) {
        left: calc(50% - 0.5 * var(--hex-width));
        top: calc(50% - 1.5 * var(--hex-height) - var(--gap-y));
    }
    .wallet-identifier .account:nth-child(3) {
        left: calc(50% + 0.25 * var(--hex-width) + var(--gap-x));
        top: calc(50% - 1 * var(--hex-height) - 0.5 * var(--gap-y));
    }
    .wallet-identifier .account:nth-child(4) {
        left: calc(50% + 0.25 * var(--hex-width) + var(--gap-x));
        top: calc(50% + 0.5 * var(--gap-y));
    }
    .wallet-identifier .account:nth-child(5) {
        left: calc(50% - 0.5 * var(--hex-width));
        top: calc(50% + 0.5 * var(--hex-height) + var(--gap-y));
    }
    .wallet-identifier .account:nth-child(6) {
        left: calc(50% - 1.25 * var(--hex-width) - var(--gap-x));
        top: calc(50% + 0.5 * var(--gap-y));
    }

    .wallet-identifier .account:nth-child(1) .pop-in { animation-delay: 500ms; }
    .wallet-identifier .account:nth-child(2) .pop-in { animation-delay: 550ms; }
    .wallet-identifier .account:nth-child(3) .pop-in { animation-delay: 600ms; }
    .wallet-identifier .account:nth-child(4) .pop-in { animation-delay: 650ms; }
    .wallet-identifier .account:nth-child(5) .pop-in { animation-delay: 700ms; }
    .wallet-identifier .account:nth-child(6) .pop-in { animation-delay: 750ms; }
</style>
