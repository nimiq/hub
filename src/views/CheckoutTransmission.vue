<template>
    <div class="container pad-bottom">
        <SmallPage>
            <StatusScreen
                :title="title"
                :status="status"
                :state="state"
                :message="message"
                :mainAction="$t('Reload')"
                :alternativeAction="$t('Cancel')"
                @main-action="reload"
                @alternative-action="cancel"
                lightBlue
            />
        </SmallPage>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { State } from 'vuex-class';
import { SmallPage } from '@nimiq/vue-components';
import type * as Nimiq from '@nimiq/albatross-wasm';
import StatusScreen from '../components/StatusScreen.vue';
import KeyguardClient from '@nimiq/keyguard-client';
import { i18n } from '../i18n/i18n-setup';
import { ERROR_CANCELED } from '../lib/Constants';
import { bytesToHex, hexToBytes } from '../lib/BufferUtils';
import { SignedTransaction } from '../../client/PublicRequestTypes';
import { NetworkClient } from '../lib/NetworkClient';

enum TxSendError {
    TRANSACTION_EXPIRED = 'Transaction is expired',
    TRANSACTION_NOT_RELAYED = 'Transaction could not be relayed',
    TRANSACTION_INVALID = 'Transaction invalid',
}

@Component({components: {StatusScreen, SmallPage}})
export default class CheckoutTransmission extends Vue {
    @State private keyguardResult!: KeyguardClient.SignTransactionResult;

    private status: string = i18n.t('Connecting to network...') as string;
    private state = StatusScreen.State.LOADING;
    private message: string = '';

    private created() {
        const $subtitle = document.querySelector('.logo .logo-subtitle')!;
        $subtitle.textContent = 'Checkout';
    }

    private async mounted() {
        const { Transaction } = await window.loadAlbatross();

        const hex = bytesToHex(this.keyguardResult.serializedTx);
        const tx = Transaction.fromAny(hex);

        try {
            await NetworkClient.Instance.init();
            const client = await NetworkClient.Instance.innerClient;
            this.addConsensusListener(client);

            await client.waitForConsensusEstablished();
            const details = await client.sendTransaction(hex);

            if (details.state === 'new') {
                throw new Error(TxSendError.TRANSACTION_NOT_RELAYED);
            }

            if (details.state === 'expired') {
                throw new Error(TxSendError.TRANSACTION_EXPIRED);
            }

            if (details.state === 'invalidated') {
                throw new Error(TxSendError.TRANSACTION_INVALID);
            }

            this.state = StatusScreen.State.SUCCESS;

            const plain = tx.toPlain();
            const result: SignedTransaction = {
                serializedTx: hex,
                hash: plain.transactionHash,
                raw: {
                    ...plain,
                    senderType: tx.senderType,
                    recipientType: tx.recipientType,
                    proof: tx.proof,
                    signerPublicKey: 'publicKey' in plain.proof
                        ? hexToBytes(plain.proof.publicKey)
                        : 'creatorPublicKey' in plain.proof
                            ? hexToBytes(plain.proof.creatorPublicKey)
                            : new Uint8Array(0),
                    signature: 'signature' in plain.proof
                        ? hexToBytes(plain.proof.signature)
                        : 'creatorSignature' in plain.proof
                            ? hexToBytes(plain.proof.creatorSignature)
                            : new Uint8Array(0),
                    extraData: tx.data,
                    networkId: tx.networkId,
                },
            };

            setTimeout(() => this.$rpc.resolve(result), StatusScreen.SUCCESS_REDIRECT_DELAY);
        } catch (err) {
            const error = err as Error;
            this.state = StatusScreen.State.WARNING;
            if (error.message === TxSendError.TRANSACTION_EXPIRED) {
                this.message = this.$t('Transaction is expired') as string;
            } else if (error.message === TxSendError.TRANSACTION_NOT_RELAYED) {
                this.message = this.$t('Transaction could not be relayed') as string;
            } else {
                this.message = error.message;
            }
        }
    }

    private addConsensusListener(client: Nimiq.Client) {
        client.addConsensusChangedListener((state) => {
            if (state === 'connecting') this.status = this.$t('Contacting seed nodes...') as string;
            if (state === 'syncing') this.status = this.$t('Syncing consensus...') as string;
            if (state === 'established') this.status = this.$t('Sending transaction...') as string;
        });
    }

    private get title(): string {
        switch (this.state) {
            case StatusScreen.State.SUCCESS: return this.$t('Payment successful.') as string;
            case StatusScreen.State.WARNING: return this.$t('Something went wrong') as string;
            default: return this.$t('Processing your payment') as string;
        }
    }

    private reload() {
        window.location.reload();
    }

    private cancel() {
        this.$rpc.reject(new Error(ERROR_CANCELED));
    }
}
</script>
