import { CashlinkCurrency } from '../../client/PublicRequestTypes';
import { ICashlinkCurrencyHandler, CashlinkTransaction } from './CashlinkCurrencyHandler';
import CashlinkInteractive from './CashlinkInteractive';
import type { NetworkClient } from './NetworkClient';

const CashlinkExtraDataNimiq = {
    FUNDING:  new Uint8Array([0, 130, 128, 146, 135]), // 'CASH'.split('').map(c => c.charCodeAt(0) + 63)
    CLAIMING: new Uint8Array([0, 139, 136, 141, 138]), // 'LINK'.split('').map(c => c.charCodeAt(0) + 63)
};

export class CashlinkCurrencyHandlerNimiq implements ICashlinkCurrencyHandler<CashlinkCurrency.NIM> {
    public readonly currency = CashlinkCurrency.NIM;
    private _chainTransactions: Nimiq.PlainTransactionDetails[] = []; // transactions already included on chain

    public constructor(public readonly cashlink: CashlinkInteractive<CashlinkCurrency.NIM>) {}

    public async awaitConsensus(): Promise<void> {
        const networkClient = await this._getNetworkClient();
        return networkClient.awaitConsensus();
    }

    public async getBlockchainHeight(): Promise<number> {
        const networkClient = await this._getNetworkClient();
        const innerClient = await networkClient.innerClient;
        return innerClient.getHeadHeight();
    }

    public async getBalance(): Promise<number> {
        const networkClient = await this._getNetworkClient();
        const balances = await networkClient.getBalance([this.cashlink.address]);
        return balances.get(this.cashlink.address) || 0;
    }

    public async getFees(): Promise<number> {
        return 0; // Can typically send with 0 fees on Nimiq network.
    }

    public async getConfirmedTransactions(): Promise<CashlinkTransaction[]> {
        const networkClient = await this._getNetworkClient();
        const transactionHistory = await networkClient.getTransactionsByAddress(
            this.cashlink.address,
            // Pass our known chain transactions, such that they don't have to be fetched again (and won't be returned
            // again) if they are still included in the chain, or get their latest state if they are not on the chain
            // anymore due to rebranching (returning them for example as new/pending/expired; not entirely sure though).
            this._chainTransactions,
        );
        // Add new transactions and update previously known transactions, avoiding duplicates.
        this._chainTransactions = [...new Map([
            ...this._chainTransactions,
            ...transactionHistory,
        ].map((transaction) => [transaction.transactionHash, transaction])).values()]
            // Filter out transactions that are not included in the chain yet / anymore. Pending transactions will be
            // added later via transaction listener once included in the chain. This also handles previously included
            // transactions, which might not be included anymore due to rebranching.
            .filter((transaction) => transaction.state === 'included' || transaction.state === 'confirmed');
        // Convert to simplified CashlinkTransactions
        return this._chainTransactions.map((tx) => this._nimiqTransactionToSimplifiedCashlinkTransaction(tx));
    }

    public async getPendingTransactions(): Promise<CashlinkTransaction[]> {
        // TODO The Nimiq PoS network client currently doesn't expose pending transactions yet, different to the prior
        //  PoW client.
        return [];
    }

    public async registerTransactionListener(onTransactionAddedOrUpdated: (transaction: CashlinkTransaction) => void)
        : Promise</* unregister */ () => void> {
        // TODO consider avoiding registering duplicate listeners
        // TODO make sure to perform our additional, custom event handling for adding to _chainTransactions regardless
        //  of whether an external event handler is registered via this method.
        // TODO the Nimiq PoS network client currently only supports subscribing to transactions getting included in the
        //  chain. Should it in the future support subscribing to other transaction states, do that, too.
        const networkClient = await this._getNetworkClient();
        const innerClient = await networkClient.innerClient;
        const listenerId = await innerClient.addTransactionListener(
            (transaction: Nimiq.PlainTransactionDetails) => {
                if (transaction.recipient !== this.cashlink.address && transaction.sender !== this.cashlink.address) {
                    return;
                }
                if ((transaction.state === 'included' || transaction.state === 'confirmed')
                    && !this._chainTransactions.some((tx) => tx.transactionHash === transaction.transactionHash)) {
                    this._chainTransactions.push(transaction);
                }
                onTransactionAddedOrUpdated(this._nimiqTransactionToSimplifiedCashlinkTransaction(transaction));
            },
            [this.cashlink.address],
        );
        return () => innerClient.removeListener(listenerId);
    }

    public async getCashlinkFundingDetails(): Promise<{
        layout: 'cashlink',
        recipient: Nimiq.Address,
        value: number,
        fee: number,
        recipientData: Uint8Array,
        cashlinkMessage: string,
    }> {
        return {
            layout: 'cashlink',
            recipient: Nimiq.Address.fromUserFriendlyAddress(this.cashlink.address),
            value: this.cashlink.value,
            fee: 0, // cashlink.fee is meant for claiming transactions
            recipientData: CashlinkExtraDataNimiq.FUNDING,
            cashlinkMessage: this.cashlink.message,
        };
    }

    public async claimCashlink(recipient: string): Promise<CashlinkTransaction> {
        await this.awaitConsensus();
        // Get latest balance and claimAmount, and get blockchain height and network id
        const [balance, blockchainHeight, networkClient, networkId] = await Promise.all([
            this.cashlink.awaitBalance(),
            this.getBlockchainHeight(),
            this._getNetworkClient(),
            this._getNetworkClient().then((client) => client.getNetworkId()),
        ]);
        const claimAmount = this.cashlink.claimableAmount;
        let fee = this.cashlink.fee;
        if (balance < claimAmount + fee) {
            if (balance >= claimAmount) {
                // Try to claim potential dust with lower/no fee.
                fee = balance - claimAmount;
            } else {
                throw new Error('Cannot claim, there is not enough balance in this Cashlink');
            }
        }
        const transaction = new Nimiq.Transaction(
            Nimiq.Address.fromUserFriendlyAddress(this.cashlink.address), Nimiq.AccountType.Basic, new Uint8Array(0),
            Nimiq.Address.fromUserFriendlyAddress(recipient), Nimiq.AccountType.Basic, CashlinkExtraDataNimiq.CLAIMING,
            BigInt(claimAmount), BigInt(fee),
            Nimiq.TransactionFlag.None,
            blockchainHeight,
            networkId,
        );

        // Sign transaction
        const privateKey = Nimiq.PrivateKey.deserialize(this.cashlink.secret);
        const publicKey = Nimiq.PublicKey.derive(privateKey);
        const signature = Nimiq.Signature.create(privateKey, publicKey, transaction.serializeContent());
        const proof = Nimiq.SignatureProof.singleSig(publicKey, signature);

        // Send transaction
        const basicTransactionInfo = {
            sender: transaction.sender.toUserFriendlyAddress(),
            recipient: transaction.sender.toUserFriendlyAddress(),
            value: Number(transaction.value),
            fee: Number(transaction.fee),
        };
        await networkClient.relayTransaction({
            ...basicTransactionInfo,
            senderPubKey: proof.publicKey.serialize(),
            validityStartHeight: transaction.validityStartHeight,
            signature: proof.signature.serialize(),
            extraData: transaction.data,
        });
        return {
            ...basicTransactionInfo,
            state: 'pending',
            transactionHash: transaction.hash(),
        };
    }

    private async _getNetworkClient(): Promise<NetworkClient> {
        // tslint:disable-next-line:no-shadowed-variable
        const { NetworkClient } = await import('./NetworkClient');
        const networkClient = NetworkClient.Instance;
        await networkClient.init();
        return networkClient;
    }

    private _nimiqTransactionToSimplifiedCashlinkTransaction(transaction: Nimiq.PlainTransactionDetails)
        : CashlinkTransaction {
        return {
            transactionHash: transaction.transactionHash,
            sender: transaction.sender,
            recipient: transaction.recipient,
            value: transaction.value,
            fee: transaction.fee,
            state: ({
                new: 'pending',
                pending: 'pending',
                included: 'confirmed',
                confirmed: 'confirmed',
                invalidated: 'expired',
                expired: 'expired',
            } as const)[transaction.state],
        };
    }
}
