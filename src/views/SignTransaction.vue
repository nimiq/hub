<template>
    <div class="container">
        <small-page v-if="$route.name === `sign-transaction-success`">
            <router-view/>
        </small-page>
        <!-- <a class="global-close" :class="{hidden: $route.name === `sign-transaction-success`}" @click="close">Back to {{ request.appName }}</a> -->
    </div>
</template>

<script lang="ts">
import {Component, Emit, Watch, Vue} from 'vue-property-decorator';
import {SmallPage} from '@nimiq/vue-components';
import {ParsedSignTransactionRequest, SignTransactionRequest} from '../lib/RequestTypes';
import {State} from 'vuex-class';
import RpcApi from '../lib/RpcApi';
import {
    SignTransactionRequest as KSignTransactionRequest,
    SignTransactionResult as KSignTransactionResult,
} from '@nimiq/keyguard-client';
import {State as RpcState, ResponseStatus} from '@nimiq/rpc';
import { KeyStore } from '@/lib/KeyStore';
import { access } from 'fs';
import staticStore, {Static} from '../lib/StaticStore';

@Component({components: {SmallPage}})
export default class SignTransaction extends Vue {
    @Static private rpcState!: RpcState;
    @Static private request!: ParsedSignTransactionRequest;
    @State private keyguardResult!: KSignTransactionRequest | Error | null;

    public async created() {
        if (this.$route.name === `sign-transaction-success`) return;

        const key = await KeyStore.Instance.get(this.request.keyId);
        if (!key) throw new Error('KeyId not found');
        const account = key.addresses.get(this.request.sender.toUserFriendlyAddress());
        // TODO Search contracts when address not found
        if (!account) throw new Error('Sender address not found!');

        const request: KSignTransactionRequest = {
            layout: 'standard',
            appName: this.request.appName,

            keyId: key.id,
            keyPath: account.path,
            keyLabel: key.label,

            sender: this.request.sender.serialize(),
            senderType: Nimiq.Account.Type.BASIC, // FIXME Detect appropriate type here
            senderLabel: account.label,
            recipient: this.request.recipient.serialize(),
            recipientType: this.request.recipientType,
            recipientLabel: undefined, // XXX Should we accept a recipient label from outside?
            value: this.request.value,
            fee: this.request.fee || 0,
            validityStartHeight: this.request.validityStartHeight,
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

    @Watch('keyguardResult', {immediate: true})
    private onKeyguardResult() {
        if (this.keyguardResult instanceof Error) {
            // Key/Account was not imported
            console.error(this.keyguardResult);
            window.close();
        } else if (this.keyguardResult && this.rpcState) {
            // Success
            console.log(this.keyguardResult, this.rpcState);
        }
    }

    @Emit()
    private close() {
        window.close();
    }
}
</script>

<style scoped>
    .container {
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .global-close {
        display: inline-block;
        height: 27px;
        border-radius: 13.5px;
        background-color: rgba(0, 0, 0, 0.1);
        font-size: 14px;
        font-weight: 600;
        line-height: 27px;
        color: white;
        padding: 0 12px;
        cursor: pointer;
        margin-top: 64px;
        margin-bottom: 40px;
    }

    .global-close::before {
        content: '';
        display: inline-block;
        height: 11px;
        width: 11px;
        background-image: url('data:image/svg+xml,<svg height="24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M0 0h24v24H0z" fill="none"/><path fill="%23fff" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>');
        background-repeat: no-repeat;
        background-size: 16px;
        background-position: center;
        margin-right: 8px;
        margin-bottom: -1px;
    }

    .global-close.hidden {
        visibility: hidden;
        pointer-events: none;
    }
</style>
