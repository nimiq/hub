<template></template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { ParsedSignBtcTransactionRequest } from '../lib/RequestTypes';
import KeyguardClient from '@nimiq/keyguard-client';
import { Static } from '../lib/StaticStore';
import { WalletInfo } from '../lib/WalletInfo';
import { Getter } from 'vuex-class';
import { BtcAddressInfo } from '../lib/bitcoin/BtcAddressInfo';
import { BREAK } from '../lib/Constants';

@Component
export default class SignBtcTransaction extends Vue {
    @Static private request!: ParsedSignBtcTransactionRequest;
    @Getter private findWalletByBtcAddress!: (address: string) => WalletInfo | undefined;

    public async created() {
        // Forward user through Hub to Keyguard

        const senderAccount = this.findWalletByBtcAddress(this.request.inputs[0].address)!;

        const inputs: KeyguardClient.BitcoinTransactionInput[] = this.request.inputs.map((input) => {
            const addressInfo = senderAccount.findBtcAddressInfo(input.address);
            if (!addressInfo) {
                this.$rpc.reject(new Error(`Input address not found: ${input.address}`));
                throw BREAK;
            }

            return {
                keyPath: addressInfo.path,
                transactionHash: input.transactionHash,
                outputIndex: input.outputIndex,
                outputScript: input.outputScript,
                value: input.value,
            } as KeyguardClient.BitcoinTransactionInput;
        });

        let changeOutput: KeyguardClient.BitcoinTransactionChangeOutput | undefined;
        if (this.request.changeOutput) {
            const addressInfo = senderAccount.findBtcAddressInfo(this.request.changeOutput.address);
            if (!addressInfo) {
                this.$rpc.reject(new Error(`Change address not found: ${this.request.changeOutput.address}`));
                return;
            }

            changeOutput = {
                keyPath: addressInfo.path,
                address: addressInfo.address,
                value: this.request.changeOutput.value,
            };
        }

        const request: KeyguardClient.SignBtcTransactionRequest = {
            layout: 'standard',
            appName: this.request.appName,

            inputs,
            recipientOutput: this.request.output,
            changeOutput,

            keyId: senderAccount.keyId,
            keyLabel: senderAccount.labelForKeyguard,

            // flags: this.request.flags,
        };

        // staticStore.keyguardRequest = request; // Currently not used in SignBtcTransactionSuccess

        const client = this.$rpc.createKeyguardClient(true);
        client.signBtcTransaction(request);
    }
}
</script>
