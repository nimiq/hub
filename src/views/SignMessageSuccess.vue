<template>
    <Success
        text="Message signed[br]successfully"
        :appName="request.appName"
        @continue="done"
        />
</template>

<script lang="ts">
import Nimiq from '@nimiq/core-web';
import { Component, Emit, Vue } from 'vue-property-decorator';
import { State } from 'vuex-class';
import { SignMessageResult, SignMessageRequest } from '../lib/RequestTypes';
import KeyguardClient from '@nimiq/keyguard-client';
import { Static } from '@/lib/StaticStore';
import Success from '../components/Success.vue';

@Component({components: {Success}})
export default class SimpleSuccess extends Vue {
    @Static private request!: SignMessageRequest;
    // The stored keyguardRequest does not have Uint8Array, only regular arrays
    @Static private keyguardRequest!: KeyguardClient.SignMessageRequest;
    @State private keyguardResult!: KeyguardClient.SignMessageResult;

    @Emit()
    private done() {
        const result: SignMessageResult = {
            signer: new Nimiq.Address(new Uint8Array(this.keyguardRequest.signer)).toUserFriendlyAddress(),
            signerPubKey: this.keyguardResult.publicKey,
            signature: this.keyguardResult.signature,
            data: this.keyguardResult.data,
        };

        this.$rpc.resolve(result);
    }
}
</script>
