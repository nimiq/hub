<template>
    <div class="container pad-bottom">
        <SmallPage>
            <Loader state="success">
                <template slot="success">
                    <div class="success nq-icon"></div>
                    <h1 class="title nq-h1">Sending your<br>transaction now.</h1>
                </template>
            </Loader>
            <Network ref="network"/>
        </SmallPage>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import Network from '@/components/Network.vue';
import { SmallPage } from '@nimiq/vue-components';
import { SignTransactionResult } from '../lib/RequestTypes';
import { State } from 'vuex-class';
import { Static } from '../lib/StaticStore';
import Loader from '../components/Loader.vue';
import KeyguardClient from '@nimiq/keyguard-client';

@Component({components: {Network, SmallPage, Loader}})
export default class SignTransactionSuccess extends Vue {
    // The stored keyguardRequest does not have Uint8Array, only regular arrays
    @Static private keyguardRequest!: KeyguardClient.SignTransactionRequest;
    @State private keyguardResult!: KeyguardClient.SignTransactionResult;

    private async mounted() {
        const tx = await (this.$refs.network as Network).prepareTx(this.keyguardRequest, this.keyguardResult);
        const result = (this.$refs.network as Network).makeSignTransactionResult(tx);

        setTimeout(() => this.$rpc.resolve(result), Loader.SUCCESS_REDIRECT_DELAY);
    }
}
</script>
