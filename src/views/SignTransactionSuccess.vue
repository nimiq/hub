<template>
    <div class="container pad-bottom">
        <SmallPage>
            <Success
                text="Your transaction[br]is ready!"
                buttonText="Send now"
                :disabled="!isTxPrepared"
                @continue="done"
            />
            <Network ref="network"/>
        </SmallPage>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import Network from '@/components/Network.vue';
import { SmallPage } from '@nimiq/vue-components';
import { ParsedSignTransactionRequest, SignTransactionResult } from '../lib/RequestTypes';
import { State as RpcState, ResponseStatus } from '@nimiq/rpc';
import {
    SignTransactionRequest as KSignTransactionRequest,
    SignTransactionResult as KSignTransactionResult,
} from '@nimiq/keyguard-client';
import { State } from 'vuex-class';
import { Static } from '../lib/StaticStore';
import Success from '../components/Success.vue';

@Component({components: {Network, SmallPage, Success}})
export default class SignTransactionSuccess extends Vue {
    @Static private request!: ParsedSignTransactionRequest;
    @Static private rpcState!: RpcState;
    // The stored keyguardRequest does not have Uint8Array, only regular arrays
    @Static private keyguardRequest!: KSignTransactionRequest;
    @State private keyguardResult!: KSignTransactionResult;

    private result?: SignTransactionResult;
    private isTxPrepared: boolean = false;

    private async mounted() {
        const tx = await (this.$refs.network as Network).prepareTx(this.keyguardRequest, this.keyguardResult);
        this.result = (this.$refs.network as Network).makeSignTransactionResult(tx);
        this.isTxPrepared = true;
    }

    private done() {
        this.rpcState.reply(ResponseStatus.OK, this.result);
    }
}
</script>
