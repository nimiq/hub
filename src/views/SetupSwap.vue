<template></template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { ParsedSetupSwapRequest } from '../lib/RequestTypes';
import KeyguardClient from '@nimiq/keyguard-client';
import { Static } from '../lib/StaticStore';
import { WalletInfo } from '../lib/WalletInfo';
import { Getter } from 'vuex-class';
import { BtcAddressInfo } from '../lib/bitcoin/BtcAddressInfo';
import { BREAK } from '../lib/Constants';

@Component
export default class SetupSwap extends Vue {
    @Static private request!: ParsedSetupSwapRequest;
    @Getter private findWalletByAddress!: (address: string) => WalletInfo | undefined;

    public async created() {
        // Forward user through Hub to Keyguard

        const nimAddress = this.request.fund.type === 'NIM'
            ? this.request.fund.sender.toUserFriendlyAddress()
            : this.request.redeem.type === 'NIM'
                ? this.request.redeem.recipient.toUserFriendlyAddress()
                : ''; // Should never happen, if parsing works correctly
        const account = this.findWalletByAddress(nimAddress)!;

        const request: Partial<KeyguardClient.SignSwapRequest> = {
            appName: this.request.appName,

            keyId: account.keyId,
            keyLabel: account.labelForKeyguard,
        };

        // TODO: Derive new addresses, if the requested address is not in the known list

        if (this.request.fund.type === 'NIM') {
            const senderContract = account.findContractByAddress(this.request.fund.sender);
            const signer = account.findSignerForAddress(this.request.fund.sender)!;

            request.fund = {
                type: 'NIM',
                keyPath: signer.path,
                sender: (senderContract || signer).address.serialize(),
                senderType: senderContract ? senderContract.type : Nimiq.Account.Type.BASIC,
                senderLabel: (senderContract || signer).label,
                value: this.request.fund.value,
                fee: this.request.fund.fee,
                validityStartHeight: this.request.fund.validityStartHeight,
                data: this.request.fund.extraData,
            };
        }

        if (this.request.fund.type === 'BTC') {
            const inputs: KeyguardClient.BitcoinTransactionInput[] = this.request.fund.inputs.map((input) => {
                const addressInfo = account.findBtcAddressInfo(input.address);
                if (!addressInfo) {
                    this.$rpc.reject(new Error(`Input address not found: ${input.address}`));
                    throw BREAK;
                }

                return {
                    ...input,
                    keyPath: addressInfo.path,
                } as KeyguardClient.BitcoinTransactionInput;
            });

            let changeOutput: KeyguardClient.BitcoinTransactionChangeOutput | undefined;
            if (this.request.fund.changeOutput) {
                const addressInfo = account.findBtcAddressInfo(this.request.fund.changeOutput.address);
                if (!addressInfo) {
                    this.$rpc.reject(
                        new Error(`Change address not found: ${this.request.fund.changeOutput.address}`));
                    return;
                }

                changeOutput = {
                    keyPath: addressInfo.path,
                    // address: addressInfo.address,
                    value: this.request.fund.changeOutput.value,
                };
            }

            const refundAddressInfo = account.findBtcAddressInfo(this.request.fund.refundAddress);
            if (!refundAddressInfo) {
                this.$rpc.reject(new Error(`Refund address not found: ${this.request.fund.refundAddress}`));
                return;
            }

            request.fund = {
                type: 'BTC',
                inputs,
                recipientOutput: this.request.fund.output,
                changeOutput,
                htlcScript: this.request.fund.htlcScript,
                refundKeyPath: refundAddressInfo.path,
            };
        }

        if (this.request.redeem.type === 'NIM') {
            const signer = account.findSignerForAddress(this.request.redeem.recipient);
            if (!signer) {
                this.$rpc.reject(new Error(`Redeem address not found: ${this.request.redeem.recipient}`));
                return;
            }

            request.redeem = {
                type: 'NIM',
                keyPath: signer.path,
                sender: this.request.redeem.sender.serialize(),
                senderType: Nimiq.Account.Type.HTLC,
                recipient: signer.address.serialize(),
                recipientLabel: signer.label,
                value: this.request.redeem.value,
                fee: this.request.redeem.fee,
                validityStartHeight: this.request.redeem.validityStartHeight,
                data: this.request.redeem.extraData,
                htlcData: this.request.redeem.htlcData,
            };
        }

        if (this.request.redeem.type === 'BTC') {
            const input = this.request.redeem.input;

            const addressInfo = account.findBtcAddressInfo(this.request.redeem.output.address);
            if (!addressInfo) {
                this.$rpc.reject(new Error(`Redeem address not found: ${this.request.redeem.output.address}`));
                return;
            }

            const inputs: KeyguardClient.BitcoinTransactionInput[] = [{
                ...input,
                keyPath: addressInfo.path,
            }];

            const output: KeyguardClient.BitcoinTransactionChangeOutput = {
                keyPath: addressInfo.path,
                // address: addressInfo.address,
                value: this.request.redeem.output.value,
            };

            request.redeem = {
                type: 'BTC',
                inputs,
                changeOutput: output,
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

        // staticStore.keyguardRequest = request; // Currently not used in SetupSwapSuccess

        const client = this.$rpc.createKeyguardClient(true);
        client.signSwap(request as KeyguardClient.SignSwapRequest);
    }
}
</script>
