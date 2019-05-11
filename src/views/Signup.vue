<template></template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { ParsedBasicRequest } from '../lib/RequestTypes';
import { Static } from '../lib/StaticStore';
import { DEFAULT_KEY_PATH } from '@/lib/Constants';
import KeyguardClient from '@nimiq/keyguard-client';

@Component
export default class Signup extends Vue {
    @Static private request!: ParsedBasicRequest;

    public created() {
        const request: KeyguardClient.CreateRequest = {
            appName: this.request.appName,
            defaultKeyPath: DEFAULT_KEY_PATH,
        };
        const client = this.$rpc.createKeyguardClient(true);
        client.create(request);
    }
}
</script>
