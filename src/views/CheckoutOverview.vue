<template>
    <div class="checkout-overview">
        <CheckoutDetails :accountChangeable="true"/>
        <div class="page-footer">
            <button @click="proceed">Pay <Amount :amount="request.value + request.fee"/></button>
        </div>
    </div>
</template>

<script lang="ts">
import {Component, Emit, Vue} from 'vue-property-decorator';
import {Getter} from 'vuex-class';
import {Amount} from '@nimiq/vue-components';
import {SignTransactionRequest as KSignTransactionRequest} from '@nimiq/keyguard-client';
import {State as RpcState} from '@nimiq/rpc';
import CheckoutDetails from '../components/CheckoutDetails.vue';
import {AddressInfo} from '../lib/AddressInfo';
import {KeyInfo} from '../lib/KeyInfo';
import {RequestType, ParsedCheckoutRequest} from '../lib/RequestTypes';
import RpcApi from '../lib/RpcApi';
import staticStore, {Static} from '../lib/StaticStore';

@Component({components: {Amount, CheckoutDetails}})
export default class CheckoutOverview extends Vue {
    @Static private rpcState!: RpcState;
    @Static private request!: ParsedCheckoutRequest;

    @Getter private activeKey!: KeyInfo | undefined;
    @Getter private activeAccount!: AddressInfo | undefined;

    // TODO Figure out how this will be called
    @Emit()
    private proceed() {
        const key = this.activeKey;
        if (!key) {
            return; // TODO: Display error
        }

        const addressInfo = this.activeAccount;
        if (!addressInfo) {
            // TODO: Add contract support
            return;
        }

        const request: KSignTransactionRequest = {
            layout: 'checkout',
            shopOrigin: this.rpcState.origin,
            appName: this.request.appName,

            keyId: key.id,
            keyPath: addressInfo.path,
            keyLabel: key.label,

            sender: addressInfo.address.serialize(),
            senderType: Nimiq.Account.Type.BASIC,
            senderLabel: addressInfo.label,
            recipient: this.request.recipient.serialize(),
            recipientType: this.request.recipientType,
            recipientLabel: undefined, // TODO: recipient label
            value: this.request.value,
            fee: this.request.fee || 0, // TODO: proper fee estimation
            validityStartHeight: 286890, // TODO: get valid start height
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

        const client = RpcApi.createKeyguardClient(this.$store, staticStore);
        client.signTransaction(request).catch(console.error); // TODO: proper error handling
    }
}
</script>

<style scoped>
    .checkout-overview {
        display: flex;
        flex-direction: column;
        flex-grow: 1;
    }

    .page-footer {
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        align-items: center;
        padding: 4rem 8rem;
        flex-grow: 1;
    }

    .page-footer button {
        background: #724ceb;
        color: white;
    }
</style>
