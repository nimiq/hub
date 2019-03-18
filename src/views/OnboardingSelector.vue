<template>
    <div class="container">
        <OnboardingMenu @signup="signup" @login="login" @ledger="ledger"/>

        <button v-if="!request.disableBack" class="global-close nq-button-s" @click="close">
            <span class="nq-icon arrow-left"></span>
            Back to {{request.appName}}
        </button>
    </div>
</template>

<script lang="ts">
import { Component, Emit, Vue } from 'vue-property-decorator';
import { OnboardingMenu } from '@nimiq/vue-components';
import { ParsedBasicRequest, RequestType } from '@/lib/RequestTypes';
import { Static } from '@/lib/StaticStore';
import { DEFAULT_KEY_PATH, ERROR_CANCELED } from '@/lib/Constants';
import KeyguardClient from '@nimiq/keyguard-client';

@Component({components: {OnboardingMenu}})
export default class OnboardingSelector extends Vue {
    @Static private request!: ParsedBasicRequest;

    private signup() {
        const request: KeyguardClient.CreateRequest = {
            appName: this.request.appName,
            defaultKeyPath: DEFAULT_KEY_PATH,
        };
        const client = this.$rpc.createKeyguardClient();
        client.create(request);
    }

    private login() {
        const request: KeyguardClient.ImportRequest = {
            appName: this.request.appName,
            defaultKeyPath: DEFAULT_KEY_PATH,
            requestedKeyPaths: [DEFAULT_KEY_PATH],
        };
        const client = this.$rpc.createKeyguardClient();
        client.import(request);
    }

    private ledger() {
        this.$rpc.routerPush(`${RequestType.SIGNUP}-ledger`);
    }

    @Emit()
    private close() {
        this.$rpc.reject(new Error(ERROR_CANCELED));
    }
}
</script>
