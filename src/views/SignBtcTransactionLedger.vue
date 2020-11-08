<template>
    <div class="container">
        <SmallPage>
            <PageHeader>{{ $t('Confirm Transaction') }}</PageHeader>

            <div class="recipient">
                <div class="label-line">
                    <LabelAvatar :label="request.output.label" />
                    <div :class="{ italic: !request.output.label }">{{ request.output.label || $t('Unlabeled') }}</div>
                </div>
                <div class="address">{{ request.output.address }}</div>
            </div>

            <Amount class="value nq-light-blue"
                currency="btc"
                :amount="request.output.value"
                :currencyDecimals="8"
                :minDecimals="2"
                :maxDecimals="8"
            />

            <div class="fee nq-text-s">
                + <Amount
                    currency="btc"
                    :amount="fee"
                    :currencyDecimals="8"
                    :minDecimals="2"
                    :maxDecimals="8"
                />
                {{ $t('fee') }}
            </div>

            <div class="bottom-container" :class="{ 'full-height': state === constructor.State.FINISHED }">
                <LedgerUi small></LedgerUi>
                <transition name="transition-fade">
                    <StatusScreen v-if="state !== constructor.State.READY"
                        :state="statusScreenState"
                        :title="statusScreenTitle"
                        :status="statusScreenStatus"
                        :small="state === constructor.State.SYNCING">
                    </StatusScreen>
                </transition>
            </div>
        </SmallPage>

        <GlobalClose :hidden="state === constructor.State.FINISHED" />
    </div>
</template>

<script lang="ts">
import { Component } from 'vue-property-decorator';
import { SmallPage, PageHeader, Amount } from '@nimiq/vue-components';
import SignBtcTransaction, { BitcoinTransactionInfo } from './SignBtcTransaction.vue';
import StatusScreen from '../components/StatusScreen.vue';
import GlobalClose from '../components/GlobalClose.vue';
import LedgerUi from '../components/LedgerUi.vue';
import LabelAvatar from '../components/LabelAvatar.vue';
import LedgerApi, {
    TransactionInfoBitcoin as LedgerBitcoinTransactionInfo,
    RequestTypeBitcoin as LedgerApiRequestType,
} from '@nimiq/ledger-api';
import Config from 'config';
import { SignedBtcTransaction } from '../lib/PublicRequestTypes';
import { ERROR_CANCELED } from '../lib/Constants';
import { BTC_NETWORK_TEST } from '../lib/bitcoin/BitcoinConstants';
import { WalletInfo } from '../lib/WalletInfo';
import { loadBitcoinJS } from '../lib/bitcoin/BitcoinJSLoader';
import { getElectrumClient } from '../lib/bitcoin/ElectrumClient';

// Import only types to avoid bundling of lazy-loaded BitcoinJS.
type BitcoinJsTx = import('bitcoinjs-lib').Transaction;

@Component({components: {StatusScreen, SmallPage, PageHeader, Amount, GlobalClose, LedgerUi, LabelAvatar}})
export default class SignBtcTransactionLedger extends SignBtcTransaction {
    private static readonly State = {
        SYNCING: 'syncing',
        READY: 'ready',
        FINISHED: 'finished',
    };

    private state: string = SignBtcTransactionLedger.State.SYNCING;
    private fee!: number;
    private _isDestroyed: boolean = false;

    protected async created() {
        // Note that vue-class-component transforms the inheritance into a merge of vue mixins where each class retains
        // its lifecycle hooks, therefore we don't need to call super.created() here.
        const { inputs, output, changeOutput } = this.request;
        const inputAmount = inputs.reduce((sum, { value }) => sum + value, 0);
        const outputAmount = output.value + (changeOutput ? changeOutput.value : 0);
        this.fee = inputAmount - outputAmount;
    }

    protected destroyed() {
        this._isDestroyed = true;
        LedgerApi.disconnect(
            /* cancelRequest */ true,
            /* requestTypeToDisconnect */ LedgerApiRequestType.SIGN_TRANSACTION,
        );
    }

    private get statusScreenState() {
        return this.state === SignBtcTransactionLedger.State.FINISHED
            ? StatusScreen.State.SUCCESS
            : StatusScreen.State.LOADING;
    }

    private get statusScreenTitle() {
        return this.state === SignBtcTransactionLedger.State.FINISHED ? this.$t('Transaction Signed') as string : '';
    }

    private get statusScreenStatus() {
        return this.state === SignBtcTransactionLedger.State.SYNCING
            ? this.$t('Syncing with Bitcoin network...') as string
            : '';
    }

    protected async _signBtcTransaction(transactionInfo: BitcoinTransactionInfo, walletInfo: WalletInfo) {
        const [electrum] = await Promise.all([
            getElectrumClient(),
            loadBitcoinJS(),
        ]);
        // note that buffer is marked as external module in vue.config.js and internally, the buffer bundled with
        // BitcoinJS is used, therefore we retrieve it after having BitcoinJS loaded.
        // TODO change this when we don't prebuild BitcoinJS anymore
        const Buffer = await import('buffer').then((module) => module.Buffer);

        // Fetch whole input transactions for computation of Ledger's trusted inputs
        const inputTransactions: BitcoinJsTx[] = await Promise.all(transactionInfo.inputs.map(async (input) => {
            const fetchedInput = await electrum.getTransaction(input.transactionHash);

            const inputTransaction = new BitcoinJS.Transaction();
            inputTransaction.version = fetchedInput.version;
            inputTransaction.locktime = fetchedInput.locktime;

            // note: index is the index of the input among the other inputs of this transaction, not the index among the
            // other outputs of the previous transaction
            const inputInputs = fetchedInput.inputs.sort((a, b) => a.index - b.index);
            for (const { transactionHash: hashHex, outputIndex, script: scriptHex, sequence, witness } of inputInputs) {
                // transaction hash string representation is reversed, see BitcoinJS.Transaction.getId
                const hash = Buffer.from(hashHex, 'hex').reverse();
                const script = Buffer.from(scriptHex, 'hex');
                const index = inputTransaction.addInput(hash, outputIndex, sequence, script);

                inputTransaction.setWitness(index, witness.map((w) => {
                    if (typeof w === 'number') {
                        // TODO this case can actually not happen, the type in the electrum-api is wrong
                        const buffer = Buffer.alloc(1);
                        buffer[0] = w;
                        return buffer;
                    }
                    return Buffer.from(w, 'hex');
                }));
            }

            const inputOutputs = fetchedInput.outputs.sort((a, b) => a.index - b.index);
            for (const { value, script: scriptHex } of inputOutputs) {
                const script = Buffer.from(scriptHex, 'hex');
                inputTransaction.addOutput(script, value);
            }

            return inputTransaction;
        }));

        const inputs: LedgerBitcoinTransactionInfo['inputs'] = transactionInfo.inputs.map((input, i) => ({
            transaction: inputTransactions[i],
            index: input.outputIndex,
            keyPath: input.keyPath.replace(/m\//, ''),
        }));

        // Prepare outputs and pre-calculate output scripts
        const network = Config.bitcoinNetwork === BTC_NETWORK_TEST
            ? BitcoinJS.networks.testnet
            : BitcoinJS.networks.bitcoin;
        const outputs: LedgerBitcoinTransactionInfo['outputs']  = [{
            amount: transactionInfo.recipientOutput.value,
            outputScript: BitcoinJS.address.toOutputScript(
                transactionInfo.recipientOutput.address,
                network,
            ).toString('hex'),
        }];
        let changePath: string | undefined;
        if (transactionInfo.changeOutput) {
            changePath = transactionInfo.changeOutput.keyPath.replace(/^m\//, '');
            outputs.push({
                amount: transactionInfo.changeOutput.value,
                outputScript: BitcoinJS.address.toOutputScript(
                    transactionInfo.changeOutput.address,
                    network,
                ).toString('hex'),
            });
        }

        // If user left this view in the mean time, don't continue signing the transaction
        if (this._isDestroyed) return;

        // Set the state change slightly delayed to give the Ledger api time to load dependencies and the Ledger time to
        // process the request
        setTimeout(() => this.state = SignBtcTransactionLedger.State.READY, 300);

        let signedTransactionHex: string;
        try {
            signedTransactionHex = await LedgerApi.Bitcoin.signTransaction({ inputs, outputs, changePath });
        } catch (e) {
            if (this._isDestroyed) return; // user is not on this view anymore
            // If cancelled, handle the exception. Otherwise just keep the ledger ui / error message displayed.
            if (e.message.toLowerCase().indexOf('cancelled') !== -1) {
                this.$rpc.reject(new Error(ERROR_CANCELED));
            }
            return;
        }

        // If user left this view in the mean time, don't resolve
        if (this._isDestroyed) return;

        const signedTransaction = BitcoinJS.Transaction.fromHex(signedTransactionHex);

        const result: SignedBtcTransaction = {
            serializedTx: signedTransactionHex,
            hash: signedTransaction.getId(),
        };

        this.state = SignBtcTransactionLedger.State.FINISHED;
        await new Promise((resolve) => setTimeout(resolve, StatusScreen.SUCCESS_REDIRECT_DELAY));
        this.$rpc.resolve(result);
    }
}
</script>

<style scoped>
    .small-page {
        position: relative;
        align-items: center;
        padding-bottom: 26rem; /* for bottom container + additional padding */
    }

    .recipient {
        padding: 1.5rem;
        margin-top: .5rem;
        box-shadow: inset 0 0 0 1.5px rgba(31, 35, 72, 0.1);
        border-radius: 0.625rem;
    }

    .label-line {
        display: flex;
        align-items: center;
        margin-bottom: 1.5rem;
        font-size: 2rem;
    }

    .label-avatar {
        width: 3rem;
        height: 3rem;
        margin-right: 1rem;
    }

    .italic {
        font-style: italic;
    }

    .address {
        font-family: 'Fira Mono', monospace;
        font-size: 1.75rem;
    }

    .value {
        font-size: 6rem;
        margin-top: 6.25rem;
    }

    .value >>> .btc {
        margin-left: -.75rem;
        font-size: 3rem;
        font-weight: 700;
        letter-spacing: .1rem;
    }

    .fee {
        opacity: .5;
        font-size: 2rem;
    }

    .bottom-container {
        position: absolute;
        width: 100%;
        height: 23rem;
        bottom: 0;
        transition: height .4s;
    }

    .bottom-container.full-height {
        height: 100%;
    }

    .bottom-container > * {
        position: absolute;
        top: 0;
    }

    .status-screen {
        transition: opacity .4s;
    }

    .ledger-ui >>> .loading-spinner {
        margin-top: -1.25rem; /* position at same position as StatusScreen's loading spinner */
    }
</style>
