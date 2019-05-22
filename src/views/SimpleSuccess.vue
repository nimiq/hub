<template>
    <div class="container pad-bottom">
        <SmallPage>
            <StatusScreen :state="state" :lightBlue="true">
                <template slot="success">
                    <CheckmarkIcon/>
                    <h1 class="title nq-h1" v-html="text"></h1>
                </template>
            </StatusScreen>
        </SmallPage>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { SmallPage, CheckmarkIcon } from '@nimiq/vue-components';
import { State } from 'vuex-class';
import { RpcRequest, SimpleResult } from '../lib/PublicRequestTypes';
import { SimpleResult as KSimpleResult } from '@nimiq/keyguard-client';
import { Static } from '@/lib/StaticStore';
import StatusScreen from '../components/StatusScreen.vue';

@Component({components: {SmallPage, StatusScreen, CheckmarkIcon}})
export default class SimpleSuccess extends Vue {
    @Static private request!: RpcRequest;
    @State private keyguardResult!: KSimpleResult;
    private state: StatusScreen.State = StatusScreen.State.SUCCESS;

    public async mounted() {
        setTimeout(() => this.$rpc.resolve(this.keyguardResult as SimpleResult), StatusScreen.SUCCESS_REDIRECT_DELAY);
    }

    get text() {
        switch (this.$route.name) {
            case 'change-password-success':
                return 'Your password was changed.';
            default:
                throw new Error('No matching route');
        }
    }
}
</script>
