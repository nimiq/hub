<template>
    <div class="container pad-bottom">
        <SmallPage>
            <Success
                :text="text"
                :appName="request.appName"
                @continue="done"
                />
        </SmallPage>
    </div>
</template>

<script lang="ts">
import { Component, Emit, Vue } from 'vue-property-decorator';
import { SmallPage } from '@nimiq/vue-components';
import { State } from 'vuex-class';
import { RpcRequest, SimpleResult } from '../lib/RequestTypes';
import KeyguardClient from '@nimiq/keyguard-client';
import { Static } from '@/lib/StaticStore';
import Success from '../components/Success.vue';

@Component({components: {SmallPage, Success}})
export default class SimpleSuccess extends Vue {
    @Static private request!: RpcRequest;
    @State private keyguardResult!: KeyguardClient.SimpleResult;

    get text() {
        switch (this.$route.name) {
            case 'export-file-success':
                return 'Your Wallet File export[br]was successful';
            case 'export-words-success':
                return 'Your Recovery Words export[br]was successful';
            case 'export-success':
                return 'Your export[br]was successful';
            case 'change-passphrase-success':
                return 'You successfully changed your passphrase ';
            default:
                throw new Error('No matching route');
        }
    }

    @Emit()
    private done() {
        this.$rpc.resolve(this.keyguardResult as SimpleResult);
    }
}
</script>
