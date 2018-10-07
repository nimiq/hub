<template>
    <div class="checkout-overview">
        <h1>You're sending <Amount :amount="request.value + request.fee"/> to</h1>
        <Account :address="request.recipient" :label="originDomain"/>
        <div v-if="plainData" class="data">{{ plainData }}</div>
        <div class="sender-section">
            <div class="sender-nav">
                <h2>Pay with</h2>
                <button @click="changeAccount">Change</button>
            </div>
            <Account v-if="activeAccount" :address="activeAccount.address" :label="activeAccount.label" :balance="activeAccount.balance"/>
        </div>
        <div class="page-footer">
            <button @click="proceed">Pay <Amount :amount="request.value + request.fee"/></button>
        </div>
    </div>
</template>

<script lang="ts">
import {Component, Emit, Vue} from 'vue-property-decorator';
import {Getter} from 'vuex-class';
import {Amount, Account} from '@nimiq/vue-components';
import {SignTransactionRequest as KSignTransactionRequest} from '@nimiq/keyguard-client';
import {State as RpcState} from '@nimiq/rpc';
import {AddressInfo} from '../lib/AddressInfo';
import {KeyInfo} from '../lib/KeyInfo';
import {RequestType, ParsedCheckoutRequest} from '../lib/RequestTypes';
import RpcApi from '../lib/RpcApi';
import staticStore, {Static} from '../lib/StaticStore';
import Config from 'config';

@Component({components: {Amount, Account}})
export default class CheckoutOverview extends Vue {
    @Static private rpcState!: RpcState;
    @Static private request!: ParsedCheckoutRequest;

    @Getter private activeKey!: KeyInfo | undefined;
    @Getter private activeAccount!: AddressInfo | undefined;

    private get originDomain() {
        return this.rpcState.origin.split('://')[1];
    }

    private get plainData() {
        if (!this.request.data) return undefined;

        try {
            return Nimiq.BufferUtils.toAscii(this.request.data);
        } catch (err) {
            return undefined;
        }
    }

    @Emit()
    private changeAccount() {
        this.$router.push({name: `${RequestType.CHECKOUT}-change-account`});
    }

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
            validityStartHeight: 1234, // TODO: get valid start height
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

        const client = RpcApi.createKeyguardClient(this.$store, staticStore, Config.keyguardEndpoint);
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

    h1 {
        font-size: 24px;
        line-height: 29px;
        font-weight: 300;
        letter-spacing: 0.5px;
        margin: 32px 32px 8px 32px;
    }

    h1 .amount {
        font-weight: 500;
    }

    .data {
        font-size: 16px;
        line-height: 1.3;
        opacity: 0.7;
        padding: 8px 32px;
    }

    .sender-section {
        margin-top: 24px;
        padding-bottom: 16px;
        border-top: solid 1px #f0f0f0;
        border-bottom: solid 1px #f0f0f0;
        background: #fafafa;
    }

    .sender-nav {
        padding: 16px 16px 8px 16px;
        display: flex;
        flex-direction: row;
        justify-content: space-between;
    }

    .sender-nav h2 {
        margin: 8px;
        font-size: 14px;
        text-transform: uppercase;
        line-height: 0.86;
        letter-spacing: 1.5px;
        font-weight: 400;
    }

    .sender-nav button {
        background: #e5e5e5;
        padding: 8px 14px;
        width: unset;
        font-size: 14px;
        line-height: 0.86;
        box-shadow: unset;
        text-transform: unset;
        letter-spacing: 0;
    }

    .page-footer {
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        align-items: center;
        padding: 32px 64px;
        flex-grow: 1;
    }

    .page-footer button {
        background: #724ceb;
        color: white;
    }
</style>
