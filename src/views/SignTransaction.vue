<template>
    <div class="container">
        <small-page v-if="$route.name === `sign-transaction-success`">
            <router-view/>
        </small-page>
        <!-- <a class="global-close" :class="{hidden: $route.name === `sign-transaction-success`}" @click="close">Back to {{ request.appName }}</a> -->
    </div>
</template>

<script lang="ts">
import {Component, Emit, Vue} from 'vue-property-decorator';
import {SmallPage} from '@nimiq/vue-components';
import {ParsedSignTransactionRequest, SignTransactionRequest} from '../lib/RequestTypes';
import {State} from 'vuex-class';
import RpcApi from '../lib/RpcApi';
import {
    SignTransactionRequest as KSignTransactionRequest,
    SignTransactionResult as KSignTransactionResult,
} from '@nimiq/keyguard-client';
import {State as RpcState, ResponseStatus} from '@nimiq/rpc';
import { WalletStore } from '@/lib/WalletStore';
import { access } from 'fs';
import staticStore, {Static} from '../lib/StaticStore';

@Component({components: {SmallPage}})
export default class SignTransaction extends Vue {
    @Static private rpcState!: RpcState;
    @Static private request!: ParsedSignTransactionRequest;
    @State private keyguardResult!: KSignTransactionResult | Error | null;

    public async created() {
        // Since the sign-transaction flow does not currently have a landing page in the AccountsManager,
        // there is also no place to display an error or have the user try again. Thus we forward the error
        // directly to the caller (the Safe, for example) which automatically closes the window from the
        // caller side.
        // The else condition here covers all successful signature cases. If the keyguardResult is successful,
        // we do not want to restart the Keyguard request. The sending of the tx is handled in the
        // SignTransactionSuccess component, which is loaded automatically by the router.
        if (this.keyguardResult instanceof Error) {
            this.rpcState.reply(ResponseStatus.ERROR, this.keyguardResult);
        } else if (this.keyguardResult) return;

        // Forward user through AccountsManager to Keyguard

        const wallet = await WalletStore.Instance.get(this.request.walletId);
        if (!wallet) throw new Error('Wallet ID not found');
        const account = wallet.accounts.get(this.request.sender.toUserFriendlyAddress());
        if (!account) throw new Error('Sender address not found!'); // TODO Search contracts when address not found

        const request: KSignTransactionRequest = {
            layout: 'standard',
            appName: this.request.appName,

            keyId: wallet.id,
            keyPath: account.path,
            keyLabel: wallet.label,

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
            data: Array.from(request.data || []),
        });
        staticStore.keyguardRequest = storedRequest;

        const client = RpcApi.createKeyguardClient(this.$store, staticStore);
        client.signTransaction(request).catch(console.error); // TODO: proper error handling
    }

    // @Emit()
    // private close() {
    //    this.rpcState.reply(ResponseStatus.ERROR, new Error('CANCEL'));
    // }
}
</script>
