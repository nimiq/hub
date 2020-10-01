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
import { SmallPage } from '@nimiq/vue-components';
import StatusScreen from '../components/StatusScreen.vue';
import { ParsedSignBtcTransactionRequest } from '../lib/RequestTypes';
import KeyguardClient from '@nimiq/keyguard-client';
import { Static } from '../lib/StaticStore';
import { WalletInfo } from '../lib/WalletInfo';
import { Getter } from 'vuex-class';
import { BtcAddressInfo } from '../lib/bitcoin/BtcAddressInfo';
import { BREAK } from '../lib/Constants';
import { WalletStore } from '../lib/WalletStore';
import WalletInfoCollector from '@/lib/WalletInfoCollector';

@Component({components: {StatusScreen, SmallPage}})
export default class SignBtcTransaction extends Vue {
    @Static private request!: ParsedSignBtcTransactionRequest;
    @Getter private findWallet!: (id: string) => WalletInfo | undefined;

    private derivingAddresses = false;

    public async created() {
        // Forward user through Hub to Keyguard

        const walletInfo = this.findWallet(this.request.walletId)!;

        if (!walletInfo.btcXPub || !walletInfo.btcAddresses || !walletInfo.btcAddresses.external.length) {
            this.$rpc.reject(new Error(`Account does not have any Bitcoin addresses`));
            return;
        }

        const inputs: KeyguardClient.BitcoinTransactionInput[] = [];

        for (const input of this.request.inputs) {
            let addressInfo = walletInfo.findBtcAddressInfo(input.address);
            if (!addressInfo) {
                this.derivingAddresses = true;

                // Derive new addresses starting from the last used index
                let index = walletInfo.btcAddresses.external.length - 1;
                for (; index >= 0; index--) {
                    if (walletInfo.btcAddresses.external[index].used) break;
                }

                const newAddresses = await WalletInfoCollector.deriveBitcoinAddresses(walletInfo.btcXPub!, index + 1);

                let i = index + 1;
                for (const external of newAddresses.external) {
                    walletInfo.btcAddresses.external[i] = external;
                    i += 1;
                }
                i = index + 1;
                for (const internal of newAddresses.internal) {
                    walletInfo.btcAddresses.internal[i] = internal;
                    i += 1;
                }

                WalletStore.Instance.put(walletInfo);

                addressInfo = walletInfo.findBtcAddressInfo(input.address);
                if (!addressInfo) {
                    this.$rpc.reject(new Error(`Input address not found: ${input.address}`));
                    throw BREAK;
                }
            }

            inputs.push({
                keyPath: addressInfo.path,
                transactionHash: input.transactionHash,
                outputIndex: input.outputIndex,
                outputScript: input.outputScript,
                value: input.value,
            });
        }

        let changeOutput: KeyguardClient.BitcoinTransactionChangeOutput | undefined;
        if (this.request.changeOutput) {
            const addressInfo = walletInfo.findBtcAddressInfo(this.request.changeOutput.address);
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

            keyId: walletInfo.keyId,
            keyLabel: walletInfo.labelForKeyguard,

            // flags: this.request.flags,
        };

        // staticStore.keyguardRequest = request; // Currently not used in SignBtcTransactionSuccess

        const client = this.$rpc.createKeyguardClient(true);
        client.signBtcTransaction(request);
    }
}
</script>
