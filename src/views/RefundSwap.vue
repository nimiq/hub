<template>
    <div v-if="derivingAddresses" class="container pad-bottom">
        <SmallPage>
            <StatusScreen
                :title="$t('Fetching your addresses')"
                :status="$t('Syncing with Bitcoin network...')"
                state="loading"
                :lightBlue="true" />
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
import { BtcAddressInfo } from '../lib/bitcoin/BtcAddressInfo';
import { SwapAsset } from '@nimiq/fastspot-api';

@Component({components: {StatusScreen, SmallPage}})
export default class SetupSwap extends Vue {
    @Static private request!: ParsedRefundSwapRequest;
    @Getter private findWallet!: (id: string) => WalletInfo | undefined;

    private derivingAddresses = false;

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
            let hasDerivedAddresses = false;
            let addressInfo = await account.findBtcAddressInfo(this.request.refund.refundAddress);
            if (addressInfo instanceof Promise) {
                this.derivingAddresses = true;
                hasDerivedAddresses = true;
                addressInfo = await addressInfo;
                this.derivingAddresses = false;
            }
            if (!addressInfo) {
                this.$rpc.reject(new Error(`Refund address not found: ${this.request.refund.refundAddress}`));
                return;
            }

            let outputAddressInfo = await account.findBtcAddressInfo(this.request.refund.output.address,
                !hasDerivedAddresses);
            if (outputAddressInfo instanceof Promise) {
                this.derivingAddresses = true;
                outputAddressInfo = await outputAddressInfo;
                this.derivingAddresses = false;
            }
            if (!outputAddressInfo) {
                this.$rpc.reject(new Error(`Output address not found: ${this.request.refund.output.address}`));
                return;
            }

            const request: KeyguardClient.SignBtcTransactionRequest = {
                appName: this.request.appName,

                keyId: account.keyId,
                keyLabel: account.labelForKeyguard,

                inputs: [{
                    ...this.request.refund.input,
                    keyPath: addressInfo.path,
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
