<template>
    <div class="container">
        <PaymentInfoLine v-if="rpcState" style="color: white"
                         :amount="request.value"
                         :networkFee="request.fee"
                         :networkFeeEditable="false"
                         :origin="rpcState.origin"/>
        <small-page>
            <router-view/>
        </small-page>
        <a class="global-close" :class="{hidden: $route.name === `checkout-success`}" @click="close">Cancel Payment</a>
    </div>
</template>

<script lang="ts">
import {Component, Emit, Prop, Watch, Vue} from 'vue-property-decorator';
import {AccountSelector, LoginSelector, PaymentInfoLine, SmallPage} from '@nimiq/vue-components';
import {
    RequestType,
    ParsedCheckoutRequest,
    ParsedSignTransactionRequest,
    SignTransactionResult,
} from '../lib/RequestTypes';
import {AddressInfo} from '../lib/AddressInfo';
import {KeyInfo, KeyStorageType} from '../lib/KeyInfo';
import {State, Mutation, Getter} from 'vuex-class';
import RpcApi from '../lib/RpcApi';
import {
    SignTransactionRequest as KSignTransactionRequest,
    SignTransactionResult as KSignTransactionResult,
} from '@nimiq/keyguard-client';
import {ResponseStatus, State as RpcState} from '@nimiq/rpc';
import {Static} from '../lib/StaticStore';

@Component({components: {PaymentInfoLine, SmallPage}})
export default class Checkout extends Vue {
    @State private keyguardResult!: KSignTransactionResult | Error | null;

    @Static private rpcState!: RpcState;
    @Static private request!: ParsedSignTransactionRequest;
    @Static private keyguardRequest!: any;
    // Uint8Arrays cannot be stored in SessionStorage, thus the stored request has arrays instead and is
    // thus not the type KSignTransactionRequest

    @Watch('keyguardResult', {immediate: true})
    private async onKeyguardResult() {
        if (this.keyguardResult instanceof Error) {
            //
        } else if (this.keyguardResult) {
            // Load web assembly encryption library into browser (if supported)
            await Nimiq.WasmHelper.doImportBrowser();
            // Configure to use test net for now
            Nimiq.GenesisConfig.test();

            let tx: Nimiq.Transaction;

            if (
                (this.keyguardRequest.data && this.keyguardRequest.data.length > 0)
             || this.keyguardRequest.senderType !== Nimiq.Account.Type.BASIC
             || this.keyguardRequest.recipientType !== Nimiq.Account.Type.BASIC
            ) {
                tx = new Nimiq.ExtendedTransaction(
                    new Nimiq.Address(new Nimiq.SerialBuffer(this.keyguardRequest.sender)),
                    this.keyguardRequest.senderType || Nimiq.Account.Type.BASIC,
                    new Nimiq.Address(new Nimiq.SerialBuffer(this.keyguardRequest.recipient)),
                    this.keyguardRequest.recipientType || Nimiq.Account.Type.BASIC,
                    this.keyguardRequest.value,
                    this.keyguardRequest.fee,
                    this.keyguardRequest.validityStartHeight,
                    this.keyguardRequest.flags || 0,
                    new Nimiq.SerialBuffer(this.keyguardRequest.data || 0),
                    Nimiq.SignatureProof.singleSig(
                        new Nimiq.PublicKey(this.keyguardResult.publicKey),
                        new Nimiq.Signature(this.keyguardResult.signature),
                    ).serialize(),
                    this.keyguardRequest.networkId,
                );
            } else {
                tx = new Nimiq.BasicTransaction(
                    new Nimiq.PublicKey(this.keyguardResult.publicKey),
                    new Nimiq.Address(new Nimiq.SerialBuffer(this.keyguardRequest.recipient)),
                    this.keyguardRequest.value,
                    this.keyguardRequest.fee,
                    this.keyguardRequest.validityStartHeight,
                    new Nimiq.Signature(this.keyguardResult.signature),
                    this.keyguardRequest.networkId,
                );
            }

            const result: SignTransactionResult = {
                serializedTx: tx.serialize(),

                sender: tx.sender.toUserFriendlyAddress(),
                senderType: tx.senderType,
                senderPubKey: this.keyguardResult.publicKey,

                recipient: tx.recipient.toUserFriendlyAddress(),
                recipientType: tx.recipientType,

                value: tx.value / 1e5,
                fee: tx.fee / 1e5,
                validityStartHeight: tx.validityStartHeight,

                signature: this.keyguardResult.signature,

                extraData: tx.data,
                flags: tx.flags,
                networkId: tx.networkId,

                hash: tx.hash().toBase64(),
            };

            // Forward signing result to original caller window
            this.rpcState.reply(ResponseStatus.OK, result);
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
