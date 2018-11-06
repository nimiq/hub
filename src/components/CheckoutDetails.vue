<template>
    <div class="checkout-details">
        <h1>You're sending <Amount :amount="request.value + request.fee"/> to</h1>
        <Account :address="request.recipient.toUserFriendlyAddress()" :label="originDomain"/>
        <div v-if="plainData" class="data">{{ plainData }}</div>
        <div class="sender-section">
            <div class="sender-nav">
                <h2>Pay with</h2>
                <button v-if="accountChangeable" @click="changeAccount">Change</button>
            </div>
            <Account v-if="activeAccount" :address="activeAccount.userFriendlyAddress" :label="activeAccount.label" :balance="activeAccount.balance"/>
        </div>
    </div>
</template>

<script lang="ts">
import {Component, Emit, Vue, Prop} from 'vue-property-decorator';
import {Getter} from 'vuex-class';
import {Amount, Account} from '@nimiq/vue-components';
import {State as RpcState} from '@nimiq/rpc';
import {AccountInfo} from '../lib/AccountInfo';
import {RequestType, ParsedCheckoutRequest} from '../lib/RequestTypes';
import staticStore, {Static} from '../lib/StaticStore';

@Component({components: {Amount, Account}})
export default class CheckoutDetails extends Vue {
    @Prop(Boolean) public accountChangeable!: boolean;

    @Static private rpcState!: RpcState;
    @Static private request!: ParsedCheckoutRequest;

    @Getter private activeAccount!: AccountInfo | undefined;

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
}
</script>

<style scoped>
    .checkout-details {
        display: flex;
        flex-direction: column;
        flex-shrink: 0;
    }

    h1 {
        font-size: 3rem;
        line-height: 3.625rem;
        font-weight: 300;
        letter-spacing: 0.021em;
        margin: 4rem 4rem 1rem 4rem;
    }

    h1 .amount {
        font-weight: 500;
    }

    .data {
        font-size: 2rem;
        line-height: 1.3;
        opacity: 0.7;
        padding: 1rem 4rem;
    }

    .sender-section {
        margin-top: 3rem;
        padding-bottom: 2rem;
        border-top: solid 1px #f0f0f0;
        border-bottom: solid 1px #f0f0f0;
        background: #fafafa;
    }

    .sender-nav {
        padding: 2rem 2rem 1rem 2rem;
        display: flex;
        flex-direction: row;
        justify-content: space-between;
    }

    .sender-nav h2 {
        margin: 1rem;
        font-size: 1.75rem;
        text-transform: uppercase;
        line-height: 0.86;
        letter-spacing: 0.143em;
        font-weight: 400;
    }

    .sender-nav button {
        background: #e5e5e5;
        padding: 1rem 1.75rem;
        width: unset;
        font-size: 1.75rem;
        line-height: 0.86;
        box-shadow: unset;
        text-transform: unset;
        letter-spacing: normal;
        height: auto;
    }
</style>
