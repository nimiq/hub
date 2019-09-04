<template>
    <div class="container">
        <SmallPage>
            <StatusScreen :state="state" :title="title" :message="_message" main-action="Ok"
                @main-action="_close">
            </StatusScreen>
        </SmallPage>

        <button class="global-close nq-button-s" @click="_close">
            <ArrowLeftSmallIcon/>
            Back to {{request.appName}}
        </button>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { ArrowLeftSmallIcon, SmallPage } from '@nimiq/vue-components';
import StatusScreen from '../components/StatusScreen.vue';
import { Static } from '../lib/StaticStore';
import { ParsedBasicRequest } from '../lib/RequestTypes';
import { RequestType } from '../lib/PublicRequestTypes';
import { ERROR_CANCELED } from '../lib/Constants';

@Component({components: {SmallPage, StatusScreen, ArrowLeftSmallIcon}})
export default class ErrorHandlerUnsupportedLedger extends Vue {
    @Static private request!: ParsedBasicRequest;
    private state = StatusScreen.State.LOADING;
    private title = '';

    private async mounted() {
        // As we don't want to disclose the information whether an account is a ledger account, we add a random wait
        // time until showing the UI to make it harder for a caller to reason whether a request was regularly cancelled
        // by the user or because it is a ledger account.
        const randomWaitTime = 1000 + Math.round(Math.random() * 2000); // 1-3s
        await new Promise((resolve) => setTimeout(resolve, randomWaitTime));
        this.state = StatusScreen.State.WARNING;
        this.title = 'Unsupported Request';
    }

    private get _message() {
        switch (this.request.kind) {
            case RequestType.SIGN_MESSAGE:
                return 'Message signing is not yet supported for Ledgers.';
            case RequestType.EXPORT:
                return 'Ledger accounts cannot be exported. Please refer to your 24 words backup you created '
                    + 'when setting up your device.';
            case RequestType.CHANGE_PASSWORD:
                return 'To change the PIN of your Ledger please go to the settings on your device.';
            default:
                return 'This operation is not supported for Ledgers.';
        }
    }

    private _close() {
        this.$rpc.reject(new Error(ERROR_CANCELED));
    }
}
</script>

