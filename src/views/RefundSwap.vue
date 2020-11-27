<script lang="ts">
import { Component } from 'vue-property-decorator';
import { Getter } from 'vuex-class';
import { SmallPage } from '@nimiq/vue-components';
import BitcoinSyncBaseView from './BitcoinSyncBaseView.vue';
import KeyguardClient from '@nimiq/keyguard-client';
import { BitcoinTransactionInputType } from '@nimiq/keyguard-client';
import StatusScreen from '../components/StatusScreen.vue';
import { ParsedRefundSwapRequest } from '../lib/RequestTypes';
import { Static } from '../lib/StaticStore';
import { WalletInfo } from '../lib/WalletInfo';
import { SwapAsset } from '@nimiq/fastspot-api';

@Component({components: {StatusScreen, SmallPage}}) // including components used in parent class
export default class RefundSwap extends BitcoinSyncBaseView {
    @Static private request!: ParsedRefundSwapRequest;
    @Getter private findWallet!: (id: string) => WalletInfo | undefined;

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
                this.state = this.State.SYNCING;

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

                this.state = this.State.NONE;
            } catch (e) {
                this.state = this.State.SYNCING_FAILED;
                this.error = e.message || e;
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
}
</script>
