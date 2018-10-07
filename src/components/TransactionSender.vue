<template>
    <div></div>
</template>

<script lang="ts">
import {Component, Emit, Prop, Watch, Vue} from 'vue-property-decorator';
import {SignTransactionResult} from '../lib/RequestTypes';
import RpcApi from '../lib/RpcApi';
import {
    SignTransactionRequest as KSignTransactionRequest,
    SignTransactionResult as KSignTransactionResult,
} from '@nimiq/keyguard-client';
import {State as RpcState, ResponseStatus} from '@nimiq/rpc';
import {State} from 'vuex-class';
import {Static} from '../lib/StaticStore';
import Config from 'config';

@Component({components: {}})
export default class TransactionSender extends Vue {
    @State private keyguardResult!: KSignTransactionResult;
    @Static private rpcState!: RpcState;
    @Static private keyguardRequest!: any;
    // Uint8Arrays cannot be stored in SessionStorage, thus the stored request has arrays instead and is
    // thus not exactly the type KSignTransactionRequest.

    private result?: SignTransactionResult;

    public async prepare() {
        // Load web assembly encryption library into browser (if supported)
        await Nimiq.WasmHelper.doImportBrowser();

        switch (Config.network) {
            case 'test':
                Nimiq.GenesisConfig.test();
            case 'main':
                Nimiq.GenesisConfig.main();
            default:
                throw new Error('No network specified. Please check your config');
        }

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

        this.result = {
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
    }

    public send() {
        if (!this.result) throw new Error('Transaction not prepared');
        this.rpcState.reply(ResponseStatus.OK, this.result);
    }
}
</script>
