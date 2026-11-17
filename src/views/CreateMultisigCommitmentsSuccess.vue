<template>
    <div class="container pad-bottom">
        <SmallPage>
            <StatusScreen state="success" :title="$t('Approval started')"/>
        </SmallPage>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { State } from 'vuex-class';
import KeyguardClient from '@nimiq/keyguard-client';
import { SmallPage } from '@nimiq/vue-components';
import { MultisigCommitments } from '../../client/PublicRequestTypes';
import { Static } from '../lib/StaticStore';
import StatusScreen from '../components/StatusScreen.vue';
import { ParsedCreateMultisigCommitmentsRequest } from '../lib/RequestTypes';

@Component({components: {StatusScreen, SmallPage}})
export default class CreateMultisigCommitmentsSuccess extends Vue {
    @Static private request!: ParsedCreateMultisigCommitmentsRequest;
    @State private keyguardResult!: KeyguardClient.MultisigCommitmentsResult;

    private async mounted() {
        const result: MultisigCommitments = {
            signer: this.request.signer.toUserFriendlyAddress(),
            signerPublicKey: this.keyguardResult.publicKey,
            commitments: this.keyguardResult.commitments,
            state: this.keyguardResult.state,
        };

        setTimeout(() => this.$rpc.resolve(result), StatusScreen.SUCCESS_REDIRECT_DELAY);
    }
}
</script>
