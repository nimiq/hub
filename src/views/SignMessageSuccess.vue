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
import { Component, Emit, Vue } from 'vue-property-decorator';
import { State } from 'vuex-class';
import { SignMessageResult } from '../lib/RequestTypes';
import KeyguardClient from '@nimiq/keyguard-client';
import { Static } from '@/lib/StaticStore';
import Loader from '../components/Loader.vue';
import { SmallPage } from '@nimiq/vue-components';

@Component({components: {Loader, SmallPage}})
export default class SimpleSuccess extends Vue {
    // The stored keyguardRequest does not have Uint8Array, only regular arrays
    @Static private keyguardRequest!: KeyguardClient.SignMessageRequest;
    @State private keyguardResult!: KeyguardClient.SignMessageResult;

    @Emit()
    private mounted() {
        const result: SignMessageResult = {
            signer: new Nimiq.Address(new Uint8Array(this.keyguardRequest.signer)).toUserFriendlyAddress(),
            signerPubKey: this.keyguardResult.publicKey,
            signature: this.keyguardResult.signature,
            data: this.keyguardResult.data,
        };

        setTimeout(() => this.$rpc.resolve(result), Loader.SUCCESS_REDIRECT_DELAY);
    }
}
</script>
