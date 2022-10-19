<template>
    <div class="container pad-bottom">
        <SmallPage>
            <StatusScreen state="success" :title="$t('Transaction approved')"/>
        </SmallPage>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { State } from 'vuex-class';
import KeyguardClient from '@nimiq/keyguard-client';
import { SmallPage, CheckmarkIcon } from '@nimiq/vue-components';
import { PartialSignature } from '../lib/PublicRequestTypes';
import { Static } from '../lib/StaticStore';
import StatusScreen from '../components/StatusScreen.vue';
import { ParsedSignMultisigTransactionRequest } from '../lib/RequestTypes';

@Component({components: {StatusScreen, SmallPage, CheckmarkIcon}})
export default class SignMultisigTransactionSuccess extends Vue {
    @Static private request!: ParsedSignMultisigTransactionRequest;
    @State private keyguardResult!: KeyguardClient.SignMultisigTransactionResult;

    private async mounted() {
        const result: PartialSignature = {
            signer: this.request.signer.toUserFriendlyAddress(),
            signerPublicKey: this.keyguardResult.publicKey,
            signature: this.keyguardResult.signature,
        };

        setTimeout(() => this.$rpc.resolve(result), StatusScreen.SUCCESS_REDIRECT_DELAY);
    }
}
</script>
