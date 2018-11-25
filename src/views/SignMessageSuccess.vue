<template>
    <Success
        text="Message signed[br]successfully"
        :appName="request.appName"
        @continue="done"
        />
</template>

<script lang="ts">
import { Component, Emit, Vue } from 'vue-property-decorator';
import { SmallPage } from '@nimiq/vue-components';
import { State } from 'vuex-class';
import { ResponseStatus, State as RpcState } from '@nimiq/rpc';
import { SignMessageResult, SignMessageRequest } from '../lib/RequestTypes';
import {
    SignMessageRequest as KSignMessageRequest,
    SignMessageResult as KSignMessageResult,
} from '@nimiq/keyguard-client';
import { Static } from '@/lib/StaticStore';
import Success from '../components/Success.vue';
import Utf8Tools from '../lib/Utf8Tools';

@Component({components: {SmallPage, Success}})
export default class SimpleSuccess extends Vue {
    @Static private request!: SignMessageRequest;
    @Static private rpcState!: RpcState;
    // The stored keyguardRequest does not have Uint8Array, only regular arrays
    @Static private keyguardRequest!: KSignMessageRequest;
    @State private keyguardResult!: KSignMessageResult;

    @Emit()
    private done() {
        const sentMessage = new Uint8Array(this.keyguardRequest.message);

        const message = Utf8Tools.isValidUtf8(sentMessage)
            ? Utf8Tools.utf8ByteArrayToString(sentMessage)
            : sentMessage;

        const result: SignMessageResult = {
            signer: new Nimiq.Address(new Uint8Array(this.keyguardRequest.signer)).toUserFriendlyAddress(),
            signerPubKey: this.keyguardResult.publicKey,
            signature: this.keyguardResult.signature,
            message,
        };

        this.rpcState.reply(ResponseStatus.OK, result);
    }
}
</script>
