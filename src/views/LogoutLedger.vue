<template>
    <div class="container">
        <SmallPage>
            <PageHeader>{{ $t('Mind the loss of settings') }}</PageHeader>
            <PageBody>
                <div class="warning nq-text nq-red">
                    {{ $t('Logging out will delete custom settings and names for this account.') }}
                    {{ request.appName === 'Accounts' ? $t('Contacts are not affected.') : '' }}
                </div>
                <div class="ledger-illustration"></div>
                <div class="hint nq-text">{{ $t('Your Ledger is<br>required to log in again.') }}</div>
                <button class="logout-button nq-button red" @click="_logOut">{{ $t('Log Out') }}</button>
            </PageBody>

            <StatusScreen v-if="confirmedLogout"
                state="success"
                title="You are logged out."
                class="grow-from-bottom-button">
            </StatusScreen>
        </SmallPage>

        <button class="global-close nq-button-s" @click="_close" :class="{ hidden: confirmedLogout }">
            <ArrowLeftSmallIcon/>
            {{ $t('Back to {appName}', { appName: request.appName }) }}
        </button>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { SmallPage, PageHeader, PageBody, ArrowLeftSmallIcon } from '@nimiq/vue-components';
import { ParsedSimpleRequest } from '../lib/RequestTypes';
import { WalletStore } from '@/lib/WalletStore';
import { Static } from '../lib/StaticStore';
import { ERROR_CANCELED } from '../lib/Constants';
import StatusScreen from '../components/StatusScreen.vue';

@Component({components: {SmallPage, PageHeader, PageBody, StatusScreen, ArrowLeftSmallIcon}})
export default class LogoutLedger extends Vue {
    @Static private request!: ParsedSimpleRequest;

    private confirmedLogout: boolean = false;

    private async _logOut() {
        this.confirmedLogout = true;
        await Promise.all([
            WalletStore.Instance.remove(this.request.walletId),
            new Promise((resolve) => setTimeout(resolve, StatusScreen.SUCCESS_REDIRECT_DELAY)),
        ]);
        this.$rpc.resolve({ success: true });
    }

    private _close() {
        if (this.confirmedLogout) return;
        this.$rpc.reject(new Error(ERROR_CANCELED));
    }
}
</script>

<style scoped>
    .small-page {
        position: relative;
    }

    .page-body {
        padding-top: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
    }

    .nq-text {
        opacity: 1;
    }

    .warning {
        font-weight: 600;
    }

    .hint {
        font-size: 2.5rem;
        line-height: 1.4;
    }

    .ledger-illustration {
        align-self: stretch;
        flex-grow: 1;
        background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 153 164" fill="%231F2348"><path d="M66.4 2c-6.2 2.6-11 7.3-13.7 13l-.5 1.3-14.2 34-.8-.3a2 2 0 0 0-2.5 1l-5.9 14.2c-.4 1 0 2 1 2.5l1 .3-17 40.7-.8-.3a2 2 0 0 0-2.5 1l-5.9 14.2c-.4 1 0 2 1 2.5l1 .3-6.3 15c-.8 2 .1 4.3 2 5L44 163.8c2 .8 4.2-.1 5-2l27.5-66.5 27.5 66.4c.8 2 3 2.9 5 2l41.6-17.1c1-.4 1.7-1.2 2.1-2.1.4-1 .4-2 0-3L100.8 16.4A26.4 26.4 0 0 0 66.4 2zm-22 133a2 2 0 0 1-2.5 1l-18.4-7.7a2 2 0 0 1-1.1-2.5L48.8 62a2 2 0 0 1 2.5-1l13.3 5.5 4.1 10-24.2 58.4zm106.5 7.2a2 2 0 0 1-1 2.5l-41.6 17.2a2 2 0 0 1-2.5-1L53.9 35.7a24.3 24.3 0 0 1 13.3-32c12.4-5 26.7.9 31.9 13.3l51.8 125.2z"/><path d="M90.22 32.03c-3.13 7.56-11.84 11.17-19.4 8.03-7.56-3.13-11.17-11.83-8.04-19.4 3.13-7.56 11.84-11.17 19.4-8.03 7.57 3.14 11.17 11.84 8.04 19.4zM64.56 21.41c-2.73 6.59.41 14.16 7 16.89 6.59 2.73 14.17-.41 16.9-7s-.41-14.16-7-16.89-14.18.41-16.9 7z"/></svg>') no-repeat center;
        background-size: 20rem 21.5rem;
        opacity: .5;
    }

    .logout-button {
        width: calc(100% - 6rem);
    }
</style>
