<template>
    <div class="checkout-overview">
        <CheckoutDetails :accountChangeable="true"/>
        <PageFooter :class="height === 0 ? 'shows-network' : ''">
            <Network ref="network" :visible="height === 0" message="Fetching network status" @head-change="_onHeadChange"/>
            <button class="nq-button" v-if="height > 0" @click="proceed">Pay <Amount :amount="request.value + request.fee"/></button>
        </PageFooter>
    </div>
</template>

<script lang="ts">
import { Component, Emit, Watch, Vue } from 'vue-property-decorator';
import { Getter } from 'vuex-class';
import { Amount, PageFooter } from '@nimiq/vue-components';
import { SignTransactionRequest as KSignTransactionRequest } from '@nimiq/keyguard-client';
import { State as RpcState } from '@nimiq/rpc';
import CheckoutDetails from '../components/CheckoutDetails.vue';
import { AccountInfo } from '../lib/AccountInfo';
import { WalletInfo } from '../lib/WalletInfo';
import { RequestType, ParsedCheckoutRequest } from '../lib/RequestTypes';
import staticStore, { Static } from '../lib/StaticStore';
import Network from '../components/Network.vue';

@Component({components: {Amount, PageFooter, CheckoutDetails, Network}})
export default class CheckoutOverview extends Vue {
    private static readonly TX_VALIDITY_WINDOW: number = 120;

    @Static private rpcState!: RpcState;
    @Static private request!: ParsedCheckoutRequest;

    @Getter private activeWallet!: WalletInfo | undefined;
    @Getter private activeAccount!: AccountInfo | undefined;

    private height: number = 0;

    private mounted() {
        this.setHeight();
    }

    @Emit()
    private proceed() {
        const wallet = this.activeWallet;
        if (!wallet) {
            return; // TODO: Display error
        }

        const addressInfo = this.activeAccount;
        if (!addressInfo) {
            // TODO: Add contract support
            return;
        }

        const validityStartHeight = this.height
            + 1
            - CheckoutOverview.TX_VALIDITY_WINDOW
            + this.request.validityDuration;

        const request: KSignTransactionRequest = {
            layout: 'checkout',
            shopOrigin: this.rpcState.origin,
            appName: this.request.appName,

            keyId: wallet.id,
            keyPath: addressInfo.path,
            keyLabel: wallet.label,

            sender: addressInfo.address.serialize(),
            senderType: Nimiq.Account.Type.BASIC,
            senderLabel: addressInfo.label,
            recipient: this.request.recipient.serialize(),
            recipientType: this.request.recipientType,
            recipientLabel: undefined, // TODO: recipient label
            value: this.request.value,
            fee: this.request.fee || 0, // TODO: proper fee estimation
            validityStartHeight,
            data: this.request.data,
            flags: this.request.flags,
            networkId: this.request.networkId,
        };

        const storedRequest = Object.assign({}, request, {
            sender: Array.from(request.sender),
            recipient: Array.from(request.recipient),
            data: Array.from(request.data!),
        });
        staticStore.keyguardRequest = storedRequest;

        const client = this.$rpc.createKeyguardClient();
        client.signTransaction(request).catch(console.error); // TODO: proper error handling
    }

    private async setHeight() {
        try {
            await this._setHeightFromApi();
        } catch (e) {
            console.error(e);
            await this._connectNetwork();
        }
    }

    @Watch('height')
    private logHeightChange(height: number, oldHeight: number) {
        console.debug(`Got height: ${height} (was ${oldHeight})`);
    }

    private async _setHeightFromApi() {
        const raw = await fetch('https://test-api.nimiq.watch/latest/1');
        const result = await raw.json();
        this.height = result[0].height;
    }

    private async _connectNetwork() {
        await (this.$refs.network as Network).connect();
    }

    private _onHeadChange(head: Nimiq.BlockHeader) {
        this.height = head.height;
    }
}
</script>

<style scoped>
    .checkout-overview {
        display: flex;
        flex-direction: column;
        flex-grow: 1;
    }

    .page-footer.shows-network {
        padding: 1rem;
    }

    .page-footer .nq-button {
        margin: 0 auto;
    }
</style>
