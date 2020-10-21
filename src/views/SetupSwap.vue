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
import StatusScreen from '../components/StatusScreen.vue';
import { ParsedSetupSwapRequest } from '../lib/RequestTypes';
import KeyguardClient from '@nimiq/keyguard-client';
import staticStore, { Static } from '../lib/StaticStore';
import { WalletInfo } from '../lib/WalletInfo';
import { BtcAddressInfo } from '../lib/bitcoin/BtcAddressInfo';
import { SwapAsset } from '@/lib/FastspotApi';

@Component({components: {StatusScreen, SmallPage}})
export default class SetupSwap extends Vue {
    @Static private request!: ParsedSetupSwapRequest;
    @Getter private findWalletByAddress!: (address: string) => WalletInfo | undefined;

    private derivingAddresses = false;

    public async created() {
        // Forward user through Hub to Keyguard

        const nimAddress = this.request.fund.type === SwapAsset.NIM
            ? this.request.fund.sender.toUserFriendlyAddress()
            : this.request.redeem.type === SwapAsset.NIM
                ? this.request.redeem.recipient.toUserFriendlyAddress()
                : ''; // Should never happen, if parsing works correctly
        const account = this.findWalletByAddress(nimAddress)!;

        const request: Partial<KeyguardClient.SignSwapRequest> = {
            appName: this.request.appName,

            keyId: account.keyId,
            keyLabel: account.labelForKeyguard,

            swapId: this.request.swapId,
        };

        if (this.request.fund.type === SwapAsset.NIM) {
            const senderContract = account.findContractByAddress(this.request.fund.sender);
            const signer = account.findSignerForAddress(this.request.fund.sender)!;

            request.fund = {
                type: SwapAsset.NIM,
                keyPath: signer.path,
                sender: (senderContract || signer).address.serialize(),
                senderLabel: (senderContract || signer).label,
                value: this.request.fund.value,
                fee: this.request.fund.fee,
            };
        }

        if (this.request.fund.type === SwapAsset.BTC) {
            const keyPaths: string[] = [];

            for (const input of this.request.fund.inputs) {
                let addressInfo = account.findBtcAddressInfo(input.address);
                if (addressInfo instanceof Promise) {
                    this.derivingAddresses = true;
                    addressInfo = await addressInfo;
                    this.derivingAddresses = false;
                }
                if (!addressInfo) {
                    this.$rpc.reject(new Error(`Input address not found: ${input.address}`));
                    return;
                }

                keyPaths.push(addressInfo.path);
            }

            const inputValue = this.request.fund.inputs.reduce((sum, input) => sum + input.value, 0);
            const outputValue = this.request.fund.output.value;
            const changeOutputValue = this.request.fund.changeOutput ? this.request.fund.changeOutput.value : 0;

            request.fund = {
                type: SwapAsset.BTC,
                keyPaths,
                value: outputValue,
                fee: inputValue - outputValue - changeOutputValue,
            };

            // Validate that we own the change address
            if (this.request.fund.changeOutput) {
                let addressInfo = account.findBtcAddressInfo(this.request.fund.changeOutput.address);
                if (addressInfo instanceof Promise) {
                    this.derivingAddresses = true;
                    addressInfo = await addressInfo;
                    this.derivingAddresses = false;
                }
                if (!addressInfo) {
                    this.$rpc.reject(
                        new Error(`Change address not found: ${this.request.fund.changeOutput.address}`));
                    return;
                }
            }

            // Validate that we own the refund address
            let refundAddressInfo = account.findBtcAddressInfo(this.request.fund.refundAddress);
            if (refundAddressInfo instanceof Promise) {
                this.derivingAddresses = true;
                refundAddressInfo = await refundAddressInfo;
                this.derivingAddresses = false;
            }
            if (!refundAddressInfo) {
                this.$rpc.reject(new Error(`Refund address not found: ${this.request.fund.refundAddress}`));
                return;
            }
        }

        if (this.request.redeem.type === SwapAsset.NIM) {
            const signer = account.findSignerForAddress(this.request.redeem.recipient);
            if (!signer) {
                this.$rpc.reject(new Error(`Redeem address not found: ${this.request.redeem.recipient}`));
                return;
            }

            if (!signer.address.equals(this.request.redeem.recipient)) {
                this.$rpc.reject(new Error(`Redeem address not found: ${this.request.redeem.recipient}`));
                return;
            }

            request.redeem = {
                type: SwapAsset.NIM,
                keyPath: signer.path,
                recipient: signer.address.serialize(),
                recipientLabel: signer.label,
                value: this.request.redeem.value,
                fee: this.request.redeem.fee,
            };
        }

        if (this.request.redeem.type === SwapAsset.BTC) {
            let addressInfo = account.findBtcAddressInfo(this.request.redeem.output.address);
            if (addressInfo instanceof Promise) {
                this.derivingAddresses = true;
                addressInfo = await addressInfo;
                this.derivingAddresses = false;
            }
            if (!addressInfo) {
                this.$rpc.reject(new Error(`Redeem address not found: ${this.request.redeem.output.address}`));
                return;
            }

            const keyPaths = [addressInfo.path];

            const inputValue = this.request.redeem.input.value;
            const outputValue = this.request.redeem.output.value;

            request.redeem = {
                type: SwapAsset.BTC,
                keyPaths,
                value: outputValue,
                fee: inputValue - outputValue,
            };
        }

        // Display data
        request.fiatCurrency = this.request.fiatCurrency;
        request.nimFiatRate = this.request.nimFiatRate;
        request.btcFiatRate = this.request.btcFiatRate;
        request.serviceNetworkFee = this.request.serviceNetworkFee;
        request.serviceExchangeFee = this.request.serviceExchangeFee;
        request.nimiqAddresses = this.request.nimiqAddresses;
        request.bitcoinAccount = this.request.bitcoinAccount;

        const client = this.$rpc.createKeyguardClient(true);
        client.signSwap(request as KeyguardClient.SignSwapRequest);
    }
}
</script>
