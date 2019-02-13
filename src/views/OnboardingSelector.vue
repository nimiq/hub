<template>
    <div class="container">
        <OnboardingMenu @signup="signup" @login="login" @ledger="ledger"/>

        <button class="global-close nq-button-s" @click="close">
            <span class="nq-icon arrow-left"></span>
            Back to {{request.appName}}
        </button>
    </div>
</template>

<script lang="ts">
import { Component, Emit, Vue } from 'vue-property-decorator';
import { OnboardingMenu } from '@nimiq/vue-components';
import { ParsedOnboardingRequest } from '@/lib/RequestTypes';
import { Static } from '@/lib/StaticStore';
import { DEFAULT_KEY_PATH } from '@/lib/Constants';

@Component({components: {OnboardingMenu}})
export default class OnboardingSelector extends Vue {
    @Static private request!: ParsedOnboardingRequest;

    private signup() {
        const request: KeyguardRequest.CreateRequest = {
            appName: this.request.appName,
            defaultKeyPath: DEFAULT_KEY_PATH,
        };
        const client = this.$rpc.createKeyguardClient();
        client.create(request).catch(console.error); // TODO: proper error handling
    }

    private login() {
        const request: KeyguardRequest.ImportRequest = {
            appName: this.request.appName,
            defaultKeyPath: DEFAULT_KEY_PATH,
            requestedKeyPaths: [DEFAULT_KEY_PATH],
        };
        const client = this.$rpc.createKeyguardClient();
        client.import(request).catch(console.error); // TODO: proper error handling
    }

    private ledger() {
        alert('Ledger coming soon!');
    }

    @Emit()
    private close() {
        this.$rpc.reject(new Error('CANCELED'));
    }
}
</script>
