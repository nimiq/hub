<template>
    <div>
        <h1>You are sending <Amount :amount="request.value + request.fee"/> to</h1>
        <Account :address="request.recipient" :label="originDomain"/>
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
import {Amount, Account} from '@nimiq/vue-components';
import {AddressInfo} from '../lib/AddressInfo';
import {KeyInfo} from '../lib/KeyInfo';
import {RequestType, ParsedCheckoutRequest} from '../lib/RequestTypes';
import {State, Getter} from 'vuex-class';
import RpcApi from '../lib/RpcApi';
import {SignTransactionRequest} from '../lib/keyguard/RequestTypes';
import {State as RpcState} from '@nimiq/rpc';

@Component({components: {Amount, Account}})
export default class Checkout extends Vue {
    @State('rpcState') private rpcState!: RpcState;
    @State('request') private request!: ParsedCheckoutRequest;

    @Getter private activeKey!: KeyInfo | undefined;
    @Getter private activeAccount!: AddressInfo | undefined;

    private get originDomain() {
        return this.rpcState ? this.rpcState.origin.split('://')[1] : '-unkown-';
    }

    @Emit()
    private changeAccount() {
        this.$router.push({name: `${RequestType.CHECKOUT}-change-account`});
    }

    // TODO Figure out how this will be called
    @Emit()
    private proceed() {
        const client = RpcApi.createKeyguardClient(this.$store);

        const key = this.activeKey;
        if (!key) {
            return; // TODO: Display error
        }

        const addressInfo = this.activeAccount;
        if (!addressInfo) {
            // TODO: Add contract support
            return;
        }

        const request: SignTransactionRequest = {
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

        client.signTransaction(request).catch(console.error); // TODO: proper error handling
    }
}
</script>

<style scoped>

    .page-footer button {
        background: #724ceb;
        color: white;
    }
</style>
