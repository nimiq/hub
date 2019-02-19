<template></template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { ParsedSignupRequest } from '../lib/RequestTypes';
import { Static } from '../lib/StaticStore';
import { DEFAULT_KEY_PATH } from '@/lib/Constants';
import { State } from 'vuex-class';

@Component
export default class Signup extends Vue {
    @Static private request!: ParsedSignupRequest;
    @State private keyguardResult?: KeyguardRequest.KeyResult[];

    public created() {
        if (this.keyguardResult) return;

        const request: KeyguardRequest.CreateRequest = {
            appName: this.request.appName,
            defaultKeyPath: DEFAULT_KEY_PATH,
        };
        const client = this.$rpc.createKeyguardClient();
        client.create(request).catch(console.log); // TODO: proper error handling
    }
}
</script>
