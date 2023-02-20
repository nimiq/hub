<template>
    <div v-if="state !== State.NONE" class="container">
        <SmallPage>
            <StatusScreen
                :state="statusScreenState"
                :title="statusScreenTitle"
                :status="statusScreenStatus"
                :message="statusScreenMessage"
                :mainAction="statusScreenAction"
                :lightBlue="!useDarkSyncStatusScreen"
                @main-action="_statusScreenActionHandler"
            />
        </SmallPage>

        <GlobalClose :hidden="!isGlobalCloseShown" />
    </div>
</template>

<script lang="ts">
import { Vue, Component } from 'vue-property-decorator';
import { State, Getter } from 'vuex-class';
import KeyguardClient from '@nimiq/keyguard-client';
import { SmallPage } from '@nimiq/vue-components';
import { ParsedSimpleRequest } from '../lib/RequestTypes';
import { WalletType } from '../lib/Constants';
import { WalletInfo } from '../lib/WalletInfo';
import { WalletStore } from '../lib/WalletStore';
import { Static } from '../lib/StaticStore';
import { setHistoryStorage, getHistoryStorage } from '../lib/Helpers';
import store from '../store';
import StatusScreen from '../components/StatusScreen.vue';
import GlobalClose from '../components/GlobalClose.vue';
import { PolygonAddressInfo } from '../lib/polygon/PolygonAddressInfo';

@Component({components: {StatusScreen, SmallPage, GlobalClose}}) // including components used in parent class
export default class ActivatePolygonSuccess extends Vue {
    private get State() {
        return {
            NONE: 'none',
            SYNCING: 'syncing',
            SYNCING_FAILED: 'syncing-failed',
            TRANSITION_SYNCING: 'transition-syncing', // transition ui from ActivatePolygonLedger into SYNCING state
            FINISHED: 'finished',
        };
    }

    @Static private request!: ParsedSimpleRequest;
    @State private keyguardResult!: KeyguardClient.DerivePolygonAddressResult;
    @Getter private findWallet!: (id: string) => WalletInfo | undefined;

    private state: string = this.State.NONE;
    private useDarkSyncStatusScreen = false;
    private error: string = '';

    private async created() {
        try {
            const walletInfo = this.findWallet(this.request.walletId);

            if (!walletInfo) {
                throw new Error('UNEXPECTED: accountId not found anymore in ActivatePolygonSuccess '
                    + `(${this.request.walletId})`);
            }

            if (this.keyguardResult) {
                // Cache keyguardResult to be available on reloads, in case it was set manually in ActivatePolygonLedger
                setHistoryStorage('keyguardResult', this.keyguardResult);
            } else {
                store.commit('setKeyguardResult', getHistoryStorage('keyguardResult'));
            }

            this.state = walletInfo.type === WalletType.LEDGER
                ? this.State.TRANSITION_SYNCING // set ui state from which to transition to SYNCING state
                : this.State.SYNCING;
            this.useDarkSyncStatusScreen = walletInfo.type === WalletType.LEDGER;

            walletInfo.polygonAddresses = [new PolygonAddressInfo(
                this.keyguardResult.polygonAddresses[0].keyPath,
                this.keyguardResult.polygonAddresses[0].address,
            )];

            const [result] = await Promise.all([
                walletInfo.toAccountType(),
                WalletStore.Instance.put(walletInfo),
            ]);

            this.state = this.State.FINISHED;
            setTimeout(() => this.$rpc.resolve(result), StatusScreen.SUCCESS_REDIRECT_DELAY);
        } catch (e) {
            this.state = this.State.SYNCING_FAILED;
            this.error = e.message || e;
        }
    }

    private mounted() {
        if (this.state !== this.State.TRANSITION_SYNCING) return;
        // For Ledger transition UI after first rendering a state that replicates ActivatePolygonLedger for a smooth
        // transition between the two views.
        requestAnimationFrame(() => this.state = this.State.SYNCING);
    }

    private get statusScreenState(): StatusScreen.State {
        if (this.state === this.State.FINISHED) return StatusScreen.State.SUCCESS;
        if (this.state === this.State.SYNCING_FAILED) return StatusScreen.State.ERROR;
        return StatusScreen.State.LOADING;
    }

    private get statusScreenTitle() {
        switch (this.state) {
            case this.State.SYNCING:
                return this.$t('Fetching your Addresses') as string;
            case this.State.SYNCING_FAILED:
                return this.$t('Syncing Failed') as string;
            case this.State.TRANSITION_SYNCING:
                return this.$t('Fetching your Addresses') as string;
            case this.State.FINISHED:
                return this.$t('USDC activated') as string;
            default:
                return '';
        }
    }

    private get isGlobalCloseShown() {
        return this.state === this.State.TRANSITION_SYNCING || this.state === this.State.SYNCING_FAILED;
    }

    private get statusScreenStatus() {
        if (this.state !== this.State.SYNCING) return '';
        return this.$t('Syncing with Polygon network...') as string;
    }

    private get statusScreenMessage() {
        if (this.state !== this.State.SYNCING_FAILED) return '';
        return this.$t('Syncing with Polygon network failed: {error}', { error: this.error }) as string;
    }

    private get statusScreenAction() {
        if (this.state !== this.State.SYNCING_FAILED) return '';
        return this.$t('Retry') as string;
    }

    private _statusScreenActionHandler() {
        window.location.reload();
    }
}
</script>
