<template>
    <div class="container pad-bottom">
        <SmallPage>
            <StatusScreen state="success">
                <template slot="success">
                    <CheckmarkIcon/>
                    <h1 class="title nq-h1">Sending your<br>transaction now.</h1>
                </template>
            </StatusScreen>
            <Network ref="network" :visible="false"/>
        </SmallPage>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import Network from '@/components/Network.vue';
import { SmallPage, CheckmarkIcon } from '@nimiq/vue-components';
import { SignedTransaction } from '../lib/PublicRequestTypes';
import { State } from 'vuex-class';
import { Static } from '../lib/StaticStore';
import StatusScreen from '../components/StatusScreen.vue';
import KeyguardClient from '@nimiq/keyguard-client';

@Component({components: {Network, SmallPage, StatusScreen, CheckmarkIcon}})
export default class SignTransactionSuccess extends Vue {
    @Static private keyguardRequest!: KeyguardClient.SignTransactionRequest;
    @State private keyguardResult!: KeyguardClient.SignTransactionResult;

    private async mounted() {
        const tx = await (this.$refs.network as Network).createTx(Object.assign({
            signerPubKey: this.keyguardResult.publicKey,
        }, this.keyguardResult, this.keyguardRequest));
        const result: SignedTransaction = await (this.$refs.network as Network).makeSignTransactionResult(tx);

        setTimeout(() => this.$rpc.resolve(result), StatusScreen.SUCCESS_REDIRECT_DELAY);
    }
}
</script>
