<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { State } from 'vuex-class';
import { ResponseStatus, State as RpcState } from '@nimiq/rpc';
import { RpcResult } from '@nimiq/keyguard-client';
import staticStore, { Static } from '@/lib/StaticStore';

@Component({components: {}})
export default class ErrorHandler extends Vue {
    @Static protected rpcState!: RpcState;
    @State protected keyguardResult!: RpcResult;

    public async created() {
        if (this.keyguardResult instanceof Error) {
            this.requestSpecificErrors();
            // TODO proper Error Handling
            console.log(this.keyguardResult);
            this.rpcState.reply(ResponseStatus.ERROR, this.keyguardResult);
        }
    }

    /**
     * use this in derived classes in case a specific error needs special handling.
     */
    protected requestSpecificErrors() {
        return;
    }
}
</script>
