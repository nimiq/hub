<template>
    <div class="container pad-bottom">
        <SmallPage>
            <Loader state="success">
                <template slot="success">
                    <div class="success nq-icon"></div>
                    <h1 class="title nq-h1">Your message is signed.</h1>
                </template>
            </Loader>
        </SmallPage>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { State } from 'vuex-class';
import { ParsedSignMessageRequest } from '../lib/RequestTypes';
import { SignedMessage } from '../lib/PublicRequestTypes';
import KeyguardClient from '@nimiq/keyguard-client';
import { Static } from '@/lib/StaticStore';
import Loader from '../components/Loader.vue';
import { SmallPage } from '@nimiq/vue-components';
import { Utf8Tools } from '@nimiq/utils';

@Component({components: {Loader, SmallPage}})
export default class SignMessageSuccess extends Vue {
    @Static private request!: ParsedSignMessageRequest;
    @Static private keyguardRequest!: KeyguardClient.SignMessageRequest;
    // @ts-ignore
    @State private keyguardResult!: KeyguardClient.SignMessageResult;

    private mounted() {
        const result: SignedMessage = {
            signer: new Nimiq.Address(this.keyguardRequest.signer).toUserFriendlyAddress(),
            signerPublicKey: this.keyguardResult.publicKey,
            signature: this.keyguardResult.signature,
            message: typeof this.request.message === 'string'
                ? Utf8Tools.utf8ByteArrayToString(this.keyguardResult.data)
                : this.keyguardResult.data,
        };

        setTimeout(() => this.$rpc.resolve(result), Loader.SUCCESS_REDIRECT_DELAY);
    }
}
</script>
