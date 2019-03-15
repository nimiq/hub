<template>
    <div class="container pad-bottom">
        <SmallPage>
            <Loader :state="state" :lightBlue="true">
                <template slot="success">
                    <div class="success nq-icon"></div>
                    <h1 class="title nq-h1" v-html="text"></h1>
                </template>
            </Loader>
        </SmallPage>
    </div>
</template>

<script lang="ts">
import { Component, Emit, Vue } from 'vue-property-decorator';
import { SmallPage } from '@nimiq/vue-components';
import { State } from 'vuex-class';
import { RpcRequest, SimpleResult } from '../lib/RequestTypes';
import { SimpleResult as KSimpleResult } from '@nimiq/keyguard-client';
import { Static } from '@/lib/StaticStore';
import Loader from '../components/Loader.vue';

@Component({components: {SmallPage, Loader}})
export default class SimpleSuccess extends Vue {
    @Static private request!: RpcRequest;
    @State private keyguardResult!: KSimpleResult;
    private state: Loader.State = Loader.State.SUCCESS;

    public async mounted() {
        setTimeout(() => this.$rpc.resolve(this.keyguardResult as SimpleResult), Loader.SUCCESS_REDIRECT_DELAY);
    }

    get text() {
        switch (this.$route.name) {
            case 'export-file-success':
                return 'Your Login File export<br/>was successful';
            case 'export-words-success':
                return 'Your Recovery Words export<br/>was successful';
            case 'export-success':
                return 'Your export<br/>was successful';
            case 'change-password-success':
                return 'You successfully changed<br />your password ';
            default:
                throw new Error('No matching route');
        }
    }
}
</script>
