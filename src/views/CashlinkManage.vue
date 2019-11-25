<template>
    <div class="container pad-bottom">
        <SmallPage v-if="!isTxSent">
            <StatusScreen :title="title" :status="status" :state="state" :lightBlue="true"/>
        </SmallPage>

        <SmallPage v-else>
            {{link}}
        </SmallPage>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Watch } from 'vue-property-decorator';
import staticStore, { Static } from '../lib/StaticStore';
import { ParsedCashlinkRequest } from '../lib/RequestTypes';
import { SmallPage } from '@nimiq/vue-components';
import StatusScreen from '../components/StatusScreen.vue';
import { NetworkClient } from '@nimiq/network-client';
import { loadNimiq } from '../lib/Helpers';
import Cashlink from '../lib/Cashlink';
import { CashlinkState } from '@/lib/PublicRequestTypes';
import { CashlinkStore } from '../lib/CashlinkStore';
import { State } from 'vuex-class';
import KeyguardClient from '@nimiq/keyguard-client';

@Component({components: {
    SmallPage,
    StatusScreen,
}})
export default class CashlinkManage extends Vue {
    @Static private request!: ParsedCashlinkRequest;
    @Static private cashlink!: Cashlink;
    @Static private keyguardRequest!: KeyguardClient.SignTransactionRequest;
    @State private keyguardResult?: KeyguardClient.SignTransactionResult;

    private isTxSent: boolean = false;
    private status: string = 'Connecting to network...';
    private state: StatusScreen.State = StatusScreen.State.LOADING;

    private async mounted() {
        console.log(this.cashlink);
        console.log(this.request);
        console.log(this.keyguardRequest);

        await loadNimiq();
        const network = NetworkClient.Instance;
        await network.init();
        await network.connectPico();

        // Check if this is in fact a cashlink creation request

        if (!this.keyguardResult) {
            // If there is no keyguard result this is not a freshly funded cashlink
            // and must be retrieved from the store.
            console.log('old Cashlink');
            if (this.request.cashlinkAddress) {
                const cashlink = await CashlinkStore.Instance.get(this.request.cashlinkAddress.toUserFriendlyAddress());
                if (cashlink) {
                    this.cashlink = cashlink;
                    this.isTxSent = true;
                }
            }
        } else {
            // if there was a funding transaction the cashlink is in the static store.
            this.cashlink.networkClient = network;
            (NetworkClient.Instance).subscribe(this.cashlink.address.toUserFriendlyAddress());
            network.on(NetworkClient.Events.API_READY,
                () => this.status = 'Contacting seed nodes...');
            network.on(NetworkClient.Events.CONSENSUS_SYNCING,
                () => this.status = 'Syncing consensus...');
            network.on(NetworkClient.Events.CONSENSUS_ESTABLISHED,
                () => this.status = 'Sending transaction...');
            network.on(NetworkClient.Events.TRANSACTION_PENDING,
                () => this.status = 'Awaiting receipt confirmation...');

            const result = await network.relayTransaction({
                sender: new Nimiq.Address(this.keyguardRequest.sender).toUserFriendlyAddress(),
                senderPubKey: this.keyguardResult.publicKey,
                recipient:  new Nimiq.Address(this.keyguardRequest.recipient).toUserFriendlyAddress(),
                value: Nimiq.Policy.lunasToCoins(this.keyguardRequest.value),
                fee: Nimiq.Policy.lunasToCoins(this.keyguardRequest.fee),
                validityStartHeight: this.keyguardRequest.validityStartHeight,
                signature: this.keyguardResult.signature,
                extraData: this.keyguardRequest.data,
            });
            this.state = StatusScreen.State.SUCCESS;
            await CashlinkStore.Instance.put(this.cashlink);
            setTimeout(() => this.isTxSent = true, StatusScreen.SUCCESS_REDIRECT_DELAY);
        }
    }

    private get title(): string {
        return this.state === StatusScreen.State.LOADING ? 'Funding your Cashlink' : 'Cashlink funded.';
    }

    private get link(): string {
        return this.cashlink.render();
    }
}
</script>

<style scoped>

</style>
