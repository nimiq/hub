import Config from 'config';
import { BTC_NETWORK_TEST } from './BitcoinConstants';
import { fetchTransaction } from './ElectrumClient';

// Import only types to avoid bundling
import type { Transaction as BitcoinJs_Transaction } from 'bitcoinjs-lib';
import type { BitcoinTransactionInfo } from './BitcoinUtils';
import type { TransactionInfoBitcoin as LedgerBitcoinTransactionInfo } from '@nimiq/ledger-api';
import type { BitcoinTransactionInputType } from '@nimiq/keyguard-client';

/**
 * Prepare a bitcoin transaction for signing via the Ledger api by enriching it with complete input transactions and
 * output scripts. This is a costly operation as it involves loading bitcoinjs-lib and the electrum api, and fetching
 * transactions from the network.
 * @param transactionInfo - Bitcoin transaction info with required input details reduced to transactionHash,
 *   outputIndex, keyPath and optionally witnessScript and sequence.
 * @returns Enriched transaction info that can be passed to LedgerApi.Bitcoin.signTransaction.
 */
export async function prepareBitcoinTransactionForLedgerSigning(
    transactionInfo: Omit<BitcoinTransactionInfo, 'inputs'>
        & { inputs: Array<
            Pick<
                BitcoinTransactionInfo['inputs'][0],
                'transactionHash' | 'outputIndex' | 'keyPath'
            > & Partial<Pick<
                Exclude<BitcoinTransactionInfo['inputs'][0], { type?: BitcoinTransactionInputType.STANDARD }>,
                'witnessScript' | 'sequence'
            > >
        > },
): Promise<LedgerBitcoinTransactionInfo> {
    const bitcoinJsPromise = import('bitcoinjs-lib');

    // Fetch whole input transactions for computation of Ledger's trusted inputs.
    // Fetch them in batches of 10 to avoid too many network requests at once.
    const inputTransactions: BitcoinJs_Transaction[] = [];
    for (let i = 0; i < transactionInfo.inputs.length; i += 10) {
        const batch = transactionInfo.inputs.slice(i, i + 10);
        inputTransactions.push(...await Promise.all(batch.map((input) => fetchTransaction(input.transactionHash))));
    }

    const inputs: LedgerBitcoinTransactionInfo['inputs'] = transactionInfo.inputs.map((input, i) => ({
        transaction: inputTransactions[i],
        index: input.outputIndex,
        keyPath: input.keyPath,
        customScript: input.witnessScript,
        sequence: input.sequence,
    }));

    // Prepare outputs and pre-calculate output scripts
    // tslint:disable-next-line variable-name
    const { address: BitcoinJs_address, networks: BitcoinJs_networks } = await bitcoinJsPromise;
    const network = Config.bitcoinNetwork === BTC_NETWORK_TEST
        ? BitcoinJs_networks.testnet
        : BitcoinJs_networks.bitcoin;
    const outputs: LedgerBitcoinTransactionInfo['outputs']  = [{
        amount: transactionInfo.recipientOutput.value,
        outputScript: BitcoinJs_address.toOutputScript(
            transactionInfo.recipientOutput.address,
            network,
        ).toString('hex'),
    }];
    let changePath: string | undefined;
    if (transactionInfo.changeOutput) {
        changePath = transactionInfo.changeOutput.keyPath;
        outputs.push({
            amount: transactionInfo.changeOutput.value,
            outputScript: BitcoinJs_address.toOutputScript(
                transactionInfo.changeOutput.address,
                network,
            ).toString('hex'),
        });
    }

    return { inputs, outputs, changePath, locktime: transactionInfo.locktime };
}
