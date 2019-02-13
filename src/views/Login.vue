<template></template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { ParsedLoginRequest } from '../lib/RequestTypes';
import { ImportRequest } from '@nimiq/keyguard-client';
import { Static } from '../lib/StaticStore';
import { DEFAULT_KEY_PATH } from '@/lib/Constants';
import { State } from 'vuex-class';

@Component
export default class Login extends Vue {
    @Static private request!: ParsedLoginRequest;
    @State private keyguardResult?: KeyguardRequest.ImportResult;

    public created() {
        if (this.keyguardResult) return;

        const request: ImportRequest = {
            appName: this.request.appName,
            defaultKeyPath: DEFAULT_KEY_PATH,
            requestedKeyPaths: [DEFAULT_KEY_PATH],
        };

        const client = this.$rpc.createKeyguardClient();
        client.import(request).catch(console.error); // TODO: proper error handling
    }
}
</script>
