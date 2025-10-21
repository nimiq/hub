import Cashlink from './Cashlink';
import { NetworkClient } from './NetworkClient';
import { WalletInfo } from './WalletInfo';
import { CashlinkCurrency, CashlinkTheme } from '../../client/PublicRequestTypes';

export const CashlinkExtraData = {
    FUNDING:  new Uint8Array([0, 130, 128, 146, 135]), // 'CASH'.split('').map(c => c.charCodeAt(0) + 63)
    CLAIMING: new Uint8Array([0, 139, 136, 141, 138]), // 'LINK'.split('').map(c => c.charCodeAt(0) + 63)
};

export enum CashlinkState {
    UNKNOWN = -1,
    UNCHARGED = 0,
    CHARGING = 1,
    UNCLAIMED = 2,
    CLAIMING = 3,
    CLAIMED = 4,
}

class CashlinkInteractive<C extends CashlinkCurrency = CashlinkCurrency> extends Cashlink<C> {
    get claimableAmount() {
        if (!this.balance) {
            // The balance is not known yet, the Cashlink has not been funded yet, or has already been fully claimed.
            // Return the amount specified in the Cashlink, that would regularly be available, for display and checking
            // purposes.
            return this.value;
        }
        if (this.balance <= this.fee) {
            // The (remaining) balance is too little to even cover the fees, or can cover only the fees. Offer the
            // balance as dust (to be claimed with no fees).
            return this.balance;
        }
        if (this.balance < this.value + this.fee) {
            // The (remaining) balance is not enough to cover the full amount specified. Offer what's available.
            return this.balance - this.fee;
        }
        // The full specified amount can be claimed. The cashlink balance might even be higher than that, namely for
        // Cashlinks intended to be claimable multiple times, but the UI should only allow claiming the specified amount
        return this.value;
    }

    /**
     * @override
     */
    get isImmutable() {
        return super.isImmutable || this.state !== CashlinkState.UNCHARGED;
    }

    private static readonly LAST_CLAIMED_MULTI_CASHLINKS_STORAGE_KEY = 'cashlink-last-claimed-multi-cashlinks';

    private static _getLastClaimedMultiCashlinks(): /* cashlink addresses */ string[] {
        try {
            const storedLastClaimedMultiCashlinks = localStorage[this.LAST_CLAIMED_MULTI_CASHLINKS_STORAGE_KEY];
            if (!storedLastClaimedMultiCashlinks) return [];
            return JSON.parse(storedLastClaimedMultiCashlinks);
        } catch (e) {
            return [];
        }
    }

    private static _setLastClaimedMultiCashlink(address: string) {
        // restrict to last 5 entries to save storage space
        window.localStorage[this.LAST_CLAIMED_MULTI_CASHLINKS_STORAGE_KEY] = JSON.stringify([
            address,
            ...this._getLastClaimedMultiCashlinks(),
        ].slice(0, 5));
    }

    /**
     * Cashlink balance in the smallest unit of the Cashlink's currency
     */
    public balance: number | null = null;
    public state: CashlinkState = CashlinkState.UNKNOWN;

    private readonly _getNetwork: () => Promise<NetworkClient>;
    private _networkClientResolver!: (client: NetworkClient) => void;
    private _getUserAddresses: () => Set<string>;
    private _chainTransactions: Nimiq.PlainTransactionDetails[] = []; // transactions already included on chain
    private _detectStateTimeout: number = -1;
    private readonly _eventListeners: {[type: string]: Array<(data: any) => void>} = {};

    constructor(
        cashlink: Cashlink<C>,
    );
    constructor(
        currency: C,
        secret: Uint8Array,
        address: string,
        value?: number,
        fee?: number,
        message?: string,
        theme?: CashlinkTheme,
        timestamp?: number,
    );
    constructor(
        cashlinkOrCurrency: Cashlink<C> | C,
        secret?: Uint8Array,
        address?: string,
        value?: number,
        fee?: number,
        message?: string,
        theme?: CashlinkTheme,
        timestamp?: number,
    ) {
        // Doesn't read nice, but otherwise, typescript complains that "a 'super' call must be the first statement in
        // the constructor when a class contains initialized properties, parameter properties, or private identifiers.",
        // even if the prior code doesn't try to access the instance via this.
        super(
            cashlinkOrCurrency instanceof Cashlink ? cashlinkOrCurrency.currency : cashlinkOrCurrency,
            cashlinkOrCurrency instanceof Cashlink ? cashlinkOrCurrency.secret : secret!,
            cashlinkOrCurrency instanceof Cashlink ? cashlinkOrCurrency.address : address!,
            cashlinkOrCurrency instanceof Cashlink ? cashlinkOrCurrency.value : value,
            cashlinkOrCurrency instanceof Cashlink ? cashlinkOrCurrency.fee : fee,
            cashlinkOrCurrency instanceof Cashlink ? cashlinkOrCurrency.message : message,
            cashlinkOrCurrency instanceof Cashlink
                ? (cashlinkOrCurrency.hasEncodedTheme ? cashlinkOrCurrency.theme : undefined)
                : theme,
            cashlinkOrCurrency instanceof Cashlink ? cashlinkOrCurrency.timestamp : timestamp,
        );

        const networkPromise = new Promise<NetworkClient>((resolve) => {
            // Save resolver function for when the network client gets assigned
            this._networkClientResolver = resolve;
        });
        this._getNetwork = () => networkPromise;
        this._getUserAddresses = () => new Set(); // dummy, actual method will be set via setDependencies

        this._getNetwork().then(async (network: NetworkClient) => {
            if (!(await network.isConsensusEstablished())) {
                await network.awaitConsensus();
            }

            await Promise.all([
                this._updateBalance(),
                // Subscribe to transactions for the cashlink address.
                // TODO the Nimiq PoS network client currently only supports subscribing to transactions getting
                //  included in the chain. Should it in the future support subscribing to other transaction states, do
                //  that, too.
                network.innerClient.then((innerClient) => innerClient.addTransactionListener(
                    this._onTransactionChanged.bind(this),
                    [this.address],
                )),
            ]);
        });

        // Run initial state detection (awaits consensus and balance in detectState())
        this.detectState();
    }

    public setDependencies(
        networkClient: NetworkClient,
        userWallets: WalletInfo[] | (() => WalletInfo[]), // can be a method that returns up-to-date accounts
    ) {
        this._getUserAddresses = () => new Set(
            (typeof userWallets === 'function' ? userWallets() : userWallets).flatMap((wallet) =>
                [...wallet.accounts.values(), ...wallet.contracts].map((acc) => acc.address.toUserFriendlyAddress())),
        );

        this._networkClientResolver(networkClient);
    }

    public async detectState() {
        if ((this.constructor as typeof CashlinkInteractive)._getLastClaimedMultiCashlinks().includes(this.address)) {
            this._updateState(CashlinkState.CLAIMED);
            return;
        }

        // Avoid double invocations from events triggered at the same time. Instead, wait a little bit for all events
        // and their data to hopefully have processed on the network side, such that we don't work with outdated data.
        if (this._detectStateTimeout !== -1) return;
        await new Promise((resolve) => this._detectStateTimeout = window.setTimeout(resolve, 100));
        this._detectStateTimeout = -1;

        await this._awaitConsensus();

        const userAddresses = this._getUserAddresses();

        let balance = await this._awaitBalance();
        let pendingTransactions: Array<Partial<Nimiq.PlainTransactionDetails>>;
        let pendingFundingTx: Partial<Nimiq.PlainTransactionDetails> | undefined;
        let ourPendingClaimingTx: Partial<Nimiq.PlainTransactionDetails> | undefined;
        [pendingTransactions, pendingFundingTx, ourPendingClaimingTx] = await this._getPendingTransactions();
        let ourChainClaimingTx = this._chainTransactions.find( // for now based on previously known transactions
            (tx) => tx.sender === this.address && userAddresses.has(tx.recipient));

        if (ourPendingClaimingTx) {
            // Can exit early as if the user is currently claiming the cashlink, it can't be in CLAIMED state yet, as
            // the transaction is still pending and we don't allow claiming if the cashlink was last in CLAIMED state
            this._updateState(CashlinkState.CLAIMING);
            return;
        }
        if (this.state === CashlinkState.CLAIMED && (ourChainClaimingTx || (!balance && !pendingFundingTx))) {
            // Can exit early as either the user already claimed the cashlink and is not allowed to claim again or it is
            // empty and not refilled and already reached CLAIMED state, i.e. is not just empty because it is UNCHARGED.
            return;
        }

        const network = await this._getNetwork();
        const transactionHistory = await network.getTransactionsByAddress(
            this.address,
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
            // added later via _onTransactionChanged once included in the chain. This also handles previously included
            // transactions, which might not be included anymore due to rebranching.
            .filter((transaction) => transaction.state === 'included' || transaction.state === 'confirmed');

        const chainFundingTx = this._chainTransactions.find(
            (tx) => tx.recipient === this.address);
        ourChainClaimingTx = ourChainClaimingTx || this._chainTransactions.find( // update with new transactions
            (tx) => tx.sender === this.address && userAddresses.has(tx.recipient));
        const anyChainClaimingTx = ourChainClaimingTx || this._chainTransactions.find(
            (tx) => tx.sender === this.address);

        // Update balance and pending transactions after fetching transaction history as they might have changed in the
        // meantime. This update is cheap and quick.
        [balance, [pendingTransactions, pendingFundingTx, ourPendingClaimingTx]] = await Promise.all([
            this._awaitBalance(),
            this._getPendingTransactions(),
        ]);
        const anyPendingClaimingTx = ourPendingClaimingTx || pendingTransactions.find(
            (tx) => tx.sender === this.address);

        // Detect new state by a sequence of checks from UNCHARGED, CHARGING, UNCLAIMED, CLAIMING to CLAIMED states.
        // Note that cashlinks that already reached a later state in a previous detectState, can also go back to earlier
        // states again, e.g. by pending funding/claiming txs expiring, cashlink recharging or blockchain rebranching.
        let newState: CashlinkState = CashlinkState.UNCHARGED;
        if (pendingFundingTx) {
            newState = CashlinkState.CHARGING;
        }
        if (balance) {
            newState = CashlinkState.UNCLAIMED;
        }
        if (ourPendingClaimingTx) {
            // Re-check with updated ourPendingClaimingTx.
            newState = CashlinkState.CLAIMING;
        }
        if (ourChainClaimingTx
            || (chainFundingTx && (anyPendingClaimingTx || anyChainClaimingTx)
                && !balance && !pendingFundingTx && !ourPendingClaimingTx)
        ) {
            // User already claimed the cashlink and is not allowed to claim again or it had been funded but no funds
            // are left and it's not being recharged or still being claimed. Also checking whether we know at least one
            // claiming tx instead of relying on empty balance to avoid CLAIMED state after funding if chainFundingTx is
            // already known but balance update was not triggered yet.
            newState = CashlinkState.CLAIMED;
        }

        this._updateState(newState);
    }

    public getFundingDetails(): {
        layout: 'cashlink',
        recipient: Nimiq.Address,
        value: number,
        fee: number,
        recipientData: Uint8Array,
        cashlinkMessage: string,
    } {
        return {
            layout: 'cashlink',
            recipient: Nimiq.Address.fromUserFriendlyAddress(this.address),
            value: this.value,
            fee: 0, // this.fee is meant for claiming transactions
            recipientData: CashlinkExtraData.FUNDING,
            cashlinkMessage: this.message,
        };
    }

    public async claim(
        recipientAddress: string,
        recipientType: Nimiq.AccountType = Nimiq.AccountType.Basic,
    ): Promise<void> {
        if (this.state === CashlinkState.UNKNOWN) {
            await this.detectState();
        }
        if (this.state >= CashlinkState.CLAIMING) {
            throw new Error('Cannot claim, Cashlink has already been claimed');
        }

        // Get latest balance and claimAmount, and get blockchain height and network id
        const [balance, blockchainHeight, networkId] = await Promise.all([
            this._awaitBalance(),
            this._getBlockchainHeight(),
            this._getNetwork().then((network) => network.getNetworkId()),
        ]);
        const claimAmount = this.claimableAmount;
        let fee = this.fee;
        if (balance < claimAmount + fee) {
            if (balance >= claimAmount) {
                // Try to claim potential dust with lower/no fee.
                fee = balance - claimAmount;
            } else {
                throw new Error('Cannot claim, there is not enough balance in this link');
            }
        }
        const recipient = Nimiq.Address.fromString(recipientAddress);
        const transaction = new Nimiq.Transaction(
            Nimiq.Address.fromUserFriendlyAddress(this.address), Nimiq.AccountType.Basic, new Uint8Array(0),
            recipient, recipientType, CashlinkExtraData.CLAIMING,
            BigInt(claimAmount), BigInt(fee),
            Nimiq.TransactionFlag.None,
            blockchainHeight,
            networkId,
        );

        const privateKey = Nimiq.PrivateKey.deserialize(this.secret);
        const publicKey = Nimiq.PublicKey.derive(privateKey);
        const signature = Nimiq.Signature.create(privateKey, publicKey, transaction.serializeContent());
        transaction.proof = Nimiq.SignatureProof.singleSig(publicKey, signature).serialize();

        if (balance > claimAmount + fee) {
            // Remember multi-claimable Cashlink as claimed.
            (this.constructor as typeof CashlinkInteractive)._setLastClaimedMultiCashlink(this.address);
        }

        await this._sendTransaction(transaction);
        if (this.state < CashlinkState.CLAIMING) {
            this._updateState(CashlinkState.CLAIMING);
        }
    }

    public on(type: CashlinkInteractive.Events, callback: (data: any) => void): void {
        if (!(type in this._eventListeners)) {
            this._eventListeners[type] = [];
        }
        this._eventListeners[type].push(callback);
    }

    public off(type: CashlinkInteractive.Events, callback: (data: any) => void): void {
        if (!(type in this._eventListeners)) {
            return;
        }
        const index = this._eventListeners[type].indexOf(callback);
        if (index === -1) {
            return;
        }
        this._eventListeners[type].splice(index, 1);
    }

    public fire(type: CashlinkInteractive.Events, arg: any): void {
        if (!(type in this._eventListeners)) {
            return;
        }
        this._eventListeners[type].forEach((callback) => callback(arg));
    }

    private async _awaitConsensus(): Promise<void> {
        const network = await this._getNetwork();
        await network.awaitConsensus();
    }

    private async _awaitBalance(): Promise<number> {
        if (this.balance !== null) return this.balance;
        return new Promise(async (resolve) => {
            const handler = async (balance: number) => {
                this.off(CashlinkInteractive.Events.BALANCE_CHANGE, handler);
                resolve(balance);
            };
            this.on(CashlinkInteractive.Events.BALANCE_CHANGE, handler);
        });
    }

    private async _sendTransaction(transaction: Nimiq.Transaction): Promise<void> {
        await this._awaitConsensus();
        try {
            const proof = Nimiq.SignatureProof.deserialize(new Nimiq.SerialBuffer(transaction.proof));
            const network = await this._getNetwork();
            await network.relayTransaction({
                sender: transaction.sender.toUserFriendlyAddress(),
                senderPubKey: proof.publicKey.serialize(),
                recipient: transaction.recipient.toUserFriendlyAddress(),
                value: Number(transaction.value),
                fee: Number(transaction.fee),
                validityStartHeight: transaction.validityStartHeight,
                signature: proof.signature.serialize(),
                extraData: transaction.data,
            });
        } catch (e) {
            console.error(e);
            throw new Error('Failed to forward transaction to the network');
        }
    }

    private async _getBlockchainHeight(): Promise<number> {
        await this._awaitConsensus();
        const network = await this._getNetwork();
        const innerClient = await network.innerClient;
        return innerClient.getHeadHeight();
    }

    private async _getPendingTransactions(): Promise<[
        /* pending transactions */ Array<Partial<Nimiq.PlainTransactionDetails>>,
        /* a pending funding tx */ Partial<Nimiq.PlainTransactionDetails> | undefined,
        /* a pending claiming tx to us */ Partial<Nimiq.PlainTransactionDetails> | undefined,
    ]> {
        // TODO The Nimiq PoS network client currently doesn't expose pending transactions yet, different to the prior
        //  PoW client.
        return [[], undefined, undefined];
        // const [network] = await Promise.all([
        //     this._getNetwork(),
        //     this._awaitConsensus(),
        // ]);
        // const userAddresses = this._getUserAddresses();
        // const pendingTransactions = [
        //     ...network.pendingTransactions,
        //     ...network.relayedTransactions,
        // ].filter((tx) => tx.sender === this.address || tx.recipient === this.address);
        //
        // const pendingFundingTx = pendingTransactions.find(
        //     (tx) => tx.recipient === this.address);
        // const ourPendingClaimingTx = pendingTransactions.find(
        //     (tx) => tx.sender === this.address && userAddresses.has(tx.recipient!));
        //
        // return [pendingTransactions, pendingFundingTx, ourPendingClaimingTx];
    }

    private async _onTransactionChanged(transaction: Nimiq.PlainTransactionDetails): Promise<void> {
        if (transaction.recipient !== this.address && transaction.sender !== this.address) return;
        if ((transaction.state === 'included' || transaction.state === 'confirmed')
            && !this._chainTransactions.some((tx) => tx.transactionHash === transaction.transactionHash)) {
            this._chainTransactions.push(transaction);
        }
        await this._updateBalance();
        await this.detectState();
    }

    private async _updateBalance() {
        const network = await this._getNetwork();
        const balances = await network.getBalance([this.address]);
        const balance = balances.get(this.address);
        if (balance === undefined || balance === this.balance) return;

        this.balance = balance;
        this.fire(CashlinkInteractive.Events.BALANCE_CHANGE, balance);
    }

    private _updateState(state: CashlinkState) {
        if (state === this.state) return;
        this.state = state;
        this.fire(CashlinkInteractive.Events.STATE_CHANGE, this.state);
    }
}

namespace CashlinkInteractive {
    export enum Events {
        BALANCE_CHANGE = 'balance-change',
        STATE_CHANGE = 'state-change',
    }
}

export default CashlinkInteractive;
