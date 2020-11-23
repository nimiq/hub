<template>
    <div v-if="state !== constructor.State.NONE" class="container pad-bottom">
        <SmallPage>
            <StatusScreen
                :state="statusScreenState"
                :title="statusScreenTitle"
                :status="statusScreenStatus"
                :message="statusScreenMessage"
                :mainAction="statusScreenAction"
                @main-action="_reload"
                lightBlue
            />
        </SmallPage>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { Getter } from 'vuex-class';
import { SmallPage } from '@nimiq/vue-components';
import KeyguardClient from '@nimiq/keyguard-client';
import { BitcoinTransactionInputType } from '@nimiq/keyguard-client';
import StatusScreen from '../components/StatusScreen.vue';
import { ParsedRefundSwapRequest } from '../lib/RequestTypes';
import { Static } from '../lib/StaticStore';
import { WalletInfo } from '../lib/WalletInfo';
import { SwapAsset } from '@nimiq/fastspot-api';

@Component({components: {StatusScreen, SmallPage}})
export default class RefundSwap extends Vue {
    private static State = {
        NONE: 'none',
        SYNCING: 'syncing',
        SYNCING_FAILED: 'syncing-failed',
    };

    @Static private request!: ParsedRefundSwapRequest;
    @Getter private findWallet!: (id: string) => WalletInfo | undefined;

    private state: string = RefundSwap.State.NONE;
    private syncError?: string;

    public async created() {
        // Forward user through Hub to Keyguard

        const account = this.findWallet(this.request.walletId)!;

        if (this.request.refund.type === SwapAsset.NIM) {
            const address = this.request.refund.recipient.toUserFriendlyAddress();
            const signer = account.findSignerForAddress(this.request.refund.recipient)!;

            const request: KeyguardClient.SignTransactionRequest = {
                appName: this.request.appName,

                keyId: account.keyId,
                keyLabel: account.labelForKeyguard,

                keyPath: signer.path,
                sender: this.request.refund.sender.serialize(), // HTLC address
                senderType: Nimiq.Account.Type.HTLC,
                senderLabel: 'HTLC',
                recipient: signer.address.serialize(), // My address, must be refund address of HTLC
                recipientLabel: signer.label,
                value: this.request.refund.value, // Luna
                fee: this.request.refund.fee, // Luna
                data: this.request.refund.extraData,
                validityStartHeight: this.request.refund.validityStartHeight,
            };

            const client = this.$rpc.createKeyguardClient(true);
            client.signTransaction(request);
        }

        if (this.request.refund.type === SwapAsset.BTC) {
            let inputKeyPath: string;
            try {
                // Note that the sync state will only be visible in UI if the sync is not instant (if we actually sync)
                this.state = RefundSwap.State.SYNCING;

                let didDeriveAddresses = false;
                let addressInfo = account.findBtcAddressInfo(this.request.refund.refundAddress);
                if (addressInfo instanceof Promise) {
                    didDeriveAddresses = true;
                    addressInfo = await addressInfo;
                }
                if (!addressInfo) {
                    this.$rpc.reject(new Error(`Refund address not found: ${this.request.refund.refundAddress}`));
                    return;
                }
                inputKeyPath = addressInfo.path;

                const outputAddressInfo = await account.findBtcAddressInfo(this.request.refund.output.address,
                    !didDeriveAddresses);
                if (!outputAddressInfo) {
                    this.$rpc.reject(new Error(`Output address not found: ${this.request.refund.output.address}`));
                    return;
                }

                this.state = RefundSwap.State.NONE;
            } catch (e) {
                this.state = RefundSwap.State.SYNCING_FAILED;
                this.syncError = e.message || e;
                return;
            }

            const request: KeyguardClient.SignBtcTransactionRequest = {
                appName: this.request.appName,

                keyId: account.keyId,
                keyLabel: account.labelForKeyguard,

                inputs: [{
                    ...this.request.refund.input,
                    keyPath: inputKeyPath,
                    type: BitcoinTransactionInputType.HTLC_REFUND,
                }],
                recipientOutput: {
                    ...this.request.refund.output,
                    label: account.label,
                },
            };

            const client = this.$rpc.createKeyguardClient(true);
            client.signBtcTransaction(request);
        }
    }

    private get statusScreenState(): StatusScreen.State {
        if (this.state === RefundSwap.State.SYNCING_FAILED) return StatusScreen.State.ERROR;
        return StatusScreen.State.LOADING;
    }

    private get statusScreenTitle() {
        switch (this.state) {
            case RefundSwap.State.SYNCING: return this.$t('Fetching your Addresses') as string;
            case RefundSwap.State.SYNCING_FAILED: return this.$t('Syncing Failed') as string;
            default: return '';
        }
    }

    private get statusScreenStatus() {
        if (this.state !== RefundSwap.State.SYNCING) return '';
        return this.$t('Syncing with Bitcoin network...') as string;
    }

    private get statusScreenMessage() {
        if (this.state !== RefundSwap.State.SYNCING_FAILED) return '';
        return this.$t('Syncing with Bitcoin network failed: {error}', { error: this.syncError });
    }

    private get statusScreenAction() {
        if (this.state !== RefundSwap.State.SYNCING_FAILED) return '';
        return this.$t('Retry') as string;
    }

    private _reload() {
        window.location.reload();
    }
}
</script>
