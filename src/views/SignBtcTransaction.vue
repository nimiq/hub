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
import { SmallPage } from '@nimiq/vue-components';
import StatusScreen from '../components/StatusScreen.vue';
import { ParsedSignBtcTransactionRequest } from '../lib/RequestTypes';
import { Static } from '../lib/StaticStore';
import { WalletInfo } from '../lib/WalletInfo';
import { Getter } from 'vuex-class';

// Import only types to avoid bundling of KeyguardClient in Ledger request if not required.
// (But note that currently, the KeyguardClient is still always bundled in th RpcApi).
type KeyguardSignBtcTransactionRequest = import('@nimiq/keyguard-client').SignBtcTransactionRequest;
type BitcoinTransactionInput = import('@nimiq/keyguard-client').BitcoinTransactionInput;
type BitcoinTransactionChangeOutput = Required<import('@nimiq/keyguard-client').BitcoinTransactionChangeOutput>;
export type BitcoinTransactionInfo = Omit<import('@nimiq/keyguard-client').BitcoinTransactionInfo, 'changeOutput'> & {
    changeOutput?: BitcoinTransactionChangeOutput,
};

@Component({components: {StatusScreen, SmallPage}})
export default class SignBtcTransaction extends Vue {
    protected static State = {
        NONE: 'none',
        SYNCING: 'syncing',
        SYNCING_FAILED: 'syncing-failed',
    };

    @Static protected request!: ParsedSignBtcTransactionRequest;
    @Getter protected findWallet!: (id: string) => WalletInfo | undefined;

    protected state: string = SignBtcTransaction.State.NONE;
    protected syncError?: string;

    protected async created() {
        const walletInfo = this.findWallet(this.request.walletId)!;

        if (!walletInfo.btcXPub || !walletInfo.btcAddresses || !walletInfo.btcAddresses.external.length) {
            this.$rpc.reject(new Error(`Account does not have any Bitcoin addresses`));
            return;
        }

        const inputs: BitcoinTransactionInput[] = [];
        let changeOutput: BitcoinTransactionChangeOutput | undefined;

        try {
            // Note that the sync state will only be visible in the UI if the sync is not instant (if we actually sync)
            this.state = SignBtcTransaction.State.SYNCING;

            for (const input of this.request.inputs) {
                const addressInfo = await walletInfo.findBtcAddressInfo(input.address);
                if (!addressInfo) {
                    this.$rpc.reject(new Error(`Input address not found: ${input.address}`));
                    return;
                }

                inputs.push({
                    keyPath: addressInfo.path,
                    transactionHash: input.transactionHash,
                    outputIndex: input.outputIndex,
                    outputScript: input.outputScript,
                    value: input.value,
                });
            }

            if (this.request.changeOutput) {
                const addressInfo = await walletInfo.findBtcAddressInfo(this.request.changeOutput.address);
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

            this.state = SignBtcTransaction.State.NONE;
        } catch (e) {
            this.state = SignBtcTransaction.State.SYNCING_FAILED;
            this.syncError = e.message || e;
            return;
        }

        this._signBtcTransaction({
            inputs,
            changeOutput,
            recipientOutput: this.request.output,
        }, walletInfo);
    }

    protected get statusScreenState(): StatusScreen.State {
        if (this.state === SignBtcTransaction.State.SYNCING_FAILED) return StatusScreen.State.ERROR;
        return StatusScreen.State.LOADING;
    }

    protected get statusScreenTitle() {
        switch (this.state) {
            case SignBtcTransaction.State.SYNCING: return this.$t('Fetching your Addresses') as string;
            case SignBtcTransaction.State.SYNCING_FAILED: return this.$t('Syncing Failed') as string;
            default: return '';
        }
    }

    protected get statusScreenStatus() {
        if (this.state !== SignBtcTransaction.State.SYNCING) return '';
        return this.$t('Syncing with Bitcoin network...') as string;
    }

    protected get statusScreenMessage() {
        if (this.state !== SignBtcTransaction.State.SYNCING_FAILED) return '';
        return this.$t('Syncing with Bitcoin network failed: {error}', { error: this.syncError });
    }

    protected get statusScreenAction() {
        if (this.state !== SignBtcTransaction.State.SYNCING_FAILED) return '';
        return this.$t('Retry') as string;
    }

    protected _signBtcTransaction(transactionInfo: BitcoinTransactionInfo, walletInfo: WalletInfo) {
        // note that this method gets overwritten for SignBtcTransactionLedger

        const request: KeyguardSignBtcTransactionRequest = {
            layout: 'standard',
            appName: this.request.appName,

            ...transactionInfo,

            keyId: walletInfo.keyId,
            keyLabel: walletInfo.labelForKeyguard,

            // flags: this.request.flags,
        };

        // staticStore.keyguardRequest = request; // Currently not used in SignBtcTransactionSuccess

        const client = this.$rpc.createKeyguardClient(true);
        client.signBtcTransaction(request);
    }

    protected _reload() {
        window.location.reload();
    }
}
</script>
