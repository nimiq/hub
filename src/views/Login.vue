<template></template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { ParsedLoginRequest } from '../lib/RequestTypes';
import KeyguardClient from '@nimiq/keyguard-client';
import { Static } from '../lib/StaticStore';
import { State } from 'vuex-class';

@Component
export default class Login extends Vue {
    @Static private request!: ParsedLoginRequest;
    @State private keyguardResult?: KeyguardClient.ImportResult;

    public created() {
        if (this.keyguardResult) return;

        const request: KeyguardClient.ImportRequest = {
            appName: this.request.appName,
            defaultKeyPath: `m/44'/242'/0'/0'`,
            requestedKeyPaths: [`m/44'/242'/0'/0'`],
        };

        const client = this.$rpc.createKeyguardClient();
        client.import(request).catch(console.error); // TODO: proper error handling
    }
}
</script>
