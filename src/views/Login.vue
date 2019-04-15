<template></template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { ParsedBasicRequest } from '../lib/RequestTypes';
import { Static } from '../lib/StaticStore';
import { DEFAULT_KEY_PATH } from '@/lib/Constants';
import KeyguardClient from '@nimiq/keyguard-client';

@Component
export default class Login extends Vue {
    @Static private request!: ParsedBasicRequest;

    public created() {
        const request: KeyguardClient.ImportRequest = {
            appName: this.request.appName,
            requestedKeyPaths: [DEFAULT_KEY_PATH],
        };

        const client = this.$rpc.createKeyguardClient();
        client.import(request);
    }
}
</script>
