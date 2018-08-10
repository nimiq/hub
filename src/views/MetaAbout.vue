<template>
    <div class="about">
        <h1>This is an meta-about page</h1>
    </div>
</template>

<script lang="ts">
    import {Component, Vue} from 'vue-property-decorator';
    import {ParsedCheckoutRequest} from '../lib/RequestTypes';
    import {State} from 'vuex-class';
    import {RpcResult as KeyguardResult} from '@/lib/keyguard/RequestTypes';
    import {ResponseStatus, State as RpcState} from '@nimiq/rpc';

    @Component({})
    export default class MetaAbout extends Vue {
        @State('request') private request!: ParsedCheckoutRequest;
        @State('keyguardResult') private keyguardResult?: KeyguardResult | Error;
        @State('rpcState') private rpcState?: RpcState;

        mounted() {
            // TODO: Move to better position
            if (this.keyguardResult && this.rpcState) {
                this.rpcState.reply((this.keyguardResult instanceof Error) ? ResponseStatus.ERROR : ResponseStatus.OK, this.keyguardResult);
            }
        }
    }
</script>

<style scoped>
    h1 {
        text-align: center;
    }

    .about {
        background: white;
        min-height: calc(100vh - var(--logo-height));
    }
</style>
