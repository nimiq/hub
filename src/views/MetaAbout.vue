<template>
    <div class="about">
        <h1>This is an meta-about page</h1>
    </div>
</template>

<script lang="ts">
    import {Component, Vue} from 'vue-property-decorator';
    import {ParsedCheckoutRequest} from '../lib/RequestTypes';
    import {State} from 'vuex-class';
    import {State as RpcState} from '@nimiq/rpc';

    @Component({})
    export default class MetaAbout extends Vue {
        @State('request') private request!: ParsedCheckoutRequest;
        @State('rpcState') private rpcState?: RpcState;
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
