// TODO make detectState private
// TODO lazy load handlers
import Cashlink from './Cashlink';
import {
    createCurrencyHandlerForCashlink,
    CashlinkCurrencyHandlerForCurrency,
    CashlinkTransaction,
    ICashlinkCurrencyHandler,
} from './CashlinkCurrencyHandler';
import {
    getLastClaimedMultiCashlinks,
    setLastClaimedMultiCashlink,
    removeLastClaimedMultiCashlink,
} from './CashlinkMultiClaimUtils';
import type { WalletInfo } from './WalletInfo';
import { CashlinkCurrency, CashlinkTheme } from '../../client/PublicRequestTypes';

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

    get updateError(): Error | null {
        return this._transactionListenerError || this._balanceError || this._stateError;
    }

    /**
     * Cashlink balance in the smallest unit of the Cashlink's currency
     */
    public balance: number | null = null;
    public state: CashlinkState = CashlinkState.UNKNOWN;

    private _currencyHandler: CashlinkCurrencyHandlerForCurrency<C>;
    private _getUserAddresses: () => Set<string>;
    private _isClaiming: boolean = false; // whether a claim by us is currently in progress, see claim
    private _confirmedTransactions: CashlinkTransaction[] = []; // transactions already included on chain
    private _detectStateTimeout: number = -1;
    // Errors of the latest attempts to register the transaction listener, update the balance and detect the state.
    private _transactionListenerError: Error | null = null;
    private _balanceError: Error | null = null;
    private _stateError: Error | null = null;
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

        this._currencyHandler = createCurrencyHandlerForCashlink(this);
        this._getUserAddresses = () => new Set(); // dummy; actual method will be set via setUserWallets

        // Start network updates and run the initial state detection (which awaits consensus and balance) in background.
        Promise.all([
            this._registerTransactionListener(),
            this._updateBalance(),
            this.detectState(),
        ]).catch(() => { /* Errors are tracked by the methods themselves. */ });
    }

    public setUserWallets(
        userWallets: WalletInfo[] | (() => WalletInfo[]), // can be a method that returns up-to-date accounts
    ) {
        this._getUserAddresses = () => {
            const wallets = typeof userWallets === 'function' ? userWallets() : userWallets; // get latest wallets
            return this._currencyHandler.getUserAddresses(wallets);
        };
    }

    public async awaitBalance(): Promise<number> {
        if (this.balance !== null) return this.balance;
        return new Promise(async (resolve) => {
            const handler = async (balance: number) => {
                this.off(CashlinkInteractive.Events.BALANCE_CHANGE, handler);
                resolve(balance);
            };
            this.on(CashlinkInteractive.Events.BALANCE_CHANGE, handler);
        });
    }

    public async detectState() {
        this._stateError = null;
        try {
            await this._detectState();
        } catch (error) {
            this._stateError = error;
            throw error;
        }
    }

    /**
     * Update balance and state. This also happens on new transactions of the Cashlink. If an update fails, the error is
     * available as updateError, until the update gets tried again, for example by calling this method.
     */
    public async update(): Promise<void> {
        const shouldRegisterTransactionListener = !!this._transactionListenerError;
        // Reset the errors of the previous update right away, and not only once the respective steps start.
        this._transactionListenerError = this._balanceError = this._stateError = null;

        if (shouldRegisterTransactionListener) {
            await this._registerTransactionListener();
        }
        await this._updateBalance();
        await this.detectState(); // run with updated balances
    }

    public getFundingDetails(...args: Parameters<CashlinkCurrencyHandlerForCurrency<C>['getCashlinkFundingDetails']>)
        : Promise<ReturnType<CashlinkCurrencyHandlerForCurrency<C>['getCashlinkFundingDetails']>>;
    public async getFundingDetails(...args: unknown[]): Promise<unknown> {
        const currencyHandler: ICashlinkCurrencyHandler<CashlinkCurrency> = this._currencyHandler;
        return currencyHandler.getCashlinkFundingDetails(...args);
    }

    public async claim(recipient: string): Promise<CashlinkTransaction> {
        if (this.state === CashlinkState.UNKNOWN) {
            await this.detectState();
        }
        if (this.state >= CashlinkState.CLAIMING) {
            throw new Error('Cannot claim, Cashlink has already been claimed');
        }

        // Change the state right away, and not only once the claiming transaction got relayed, such that the Cashlink
        // can't be claimed a second time while the transaction is on its way. While the claim is in progress, it is
        // treated as a pending claiming transaction in detectState, see _getPendingTransactions.
        this._isClaiming = true;
        this._updateState(CashlinkState.CLAIMING); // set directly, as detectState() includes a delay
        let isMultiClaimable = false;
        try {
            const balance = await this.awaitBalance();
            // Multi-claimable Cashlinks hold more than what a single claim pays out.
            isMultiClaimable = balance > this.claimableAmount + this.fee;
            if (isMultiClaimable) {
                // Remember multi-claimable Cashlink as claimed. This is done before sending the transaction, such that
                // the Cashlink is also known as claimed if the page gets reloaded or closed while it is on its way.
                setLastClaimedMultiCashlink(this.address);
            }

            return await this._currencyHandler.claimCashlink(recipient, balance, this.claimableAmount);
        } catch (e) {
            // The claiming transaction was not sent. Allow claiming again.
            if (isMultiClaimable) {
                removeLastClaimedMultiCashlink(this.address);
            }
            throw e;
        } finally {
            this._isClaiming = false;
            // Detect the state anew, now that the claim is not in progress anymore.
            this.detectState().catch(() => { /* the state gets detected again on the next update */ });
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
        // Iterate over a copy, as listeners can remove themselves while being called, see awaitBalance, which would
        // skip the listener following them otherwise.
        [...this._eventListeners[type]].forEach((callback) => callback(arg));
    }

    private async _detectState() {
        if (getLastClaimedMultiCashlinks().includes(this.address)) {
            this._updateState(CashlinkState.CLAIMED);
            return;
        }

        // Avoid double invocations from events triggered at the same time. Instead, wait a little bit for all events
        // and their data to hopefully have processed on the network side, such that we don't work with outdated data.
        if (this._detectStateTimeout !== -1) return;
        await new Promise((resolve) => this._detectStateTimeout = window.setTimeout(resolve, 100));
        this._detectStateTimeout = -1;

        await this._currencyHandler.awaitConsensus();

        const userAddresses = this._getUserAddresses();
        let balance = await this.awaitBalance();
        let pendingTransactions: CashlinkTransaction[];
        let hasPendingFundingTx: boolean;
        let hasOurPendingClaimingTx: boolean;
        [pendingTransactions, hasPendingFundingTx, hasOurPendingClaimingTx] = await this._getPendingTransactions();
        let hasOurChainClaimingTx = this._confirmedTransactions.some( // for now based on previously known transactions
            (tx) => tx.sender === this.address && userAddresses.has(tx.recipient));

        if (hasOurPendingClaimingTx) {
            // Can exit early as if the user is currently claiming the cashlink, it can't be in CLAIMED state yet, as
            // the transaction is still pending and we don't allow claiming if the cashlink was last in CLAIMED state
            this._updateState(CashlinkState.CLAIMING);
            return;
        }
        if (this.state === CashlinkState.CLAIMED && (hasOurChainClaimingTx || (!balance && !hasPendingFundingTx))) {
            // Can exit early as either the user already claimed the cashlink and is not allowed to claim again or it is
            // empty and not refilled and already reached CLAIMED state, i.e. is not just empty because it is UNCHARGED.
            return;
        }

        this._confirmedTransactions = await this._currencyHandler.getConfirmedTransactions();

        const hasChainFundingTx = this._confirmedTransactions.some(
            (tx) => tx.recipient === this.address);
        hasOurChainClaimingTx = hasOurChainClaimingTx || this._confirmedTransactions.some( // update with new txs
            (tx) => tx.sender === this.address && userAddresses.has(tx.recipient));
        const hasAnyChainClaimingTx = hasOurChainClaimingTx || this._confirmedTransactions.some(
            (tx) => tx.sender === this.address);

        // Update balance and pending transactions after fetching transaction history as they might have changed in the
        // meantime. This update is cheap and quick.
        [balance, [pendingTransactions, hasPendingFundingTx, hasOurPendingClaimingTx]] = await Promise.all([
            this.awaitBalance(),
            this._getPendingTransactions(),
        ]);
        const hasAnyPendingClaimingTx = hasOurPendingClaimingTx || pendingTransactions.some(
            (tx) => tx.sender === this.address);

        // Detect new state by a sequence of checks from UNCHARGED, CHARGING, UNCLAIMED, CLAIMING to CLAIMED states.
        // Note that cashlinks that already reached a later state in a previous detectState, can also go back to earlier
        // states again, e.g. by pending funding/claiming txs expiring or cashlink recharging. Blockchain rebranching is
        // however not handled, as transactions stay known once they were reported on chain, even if a rebranch forks
        // them away later.
        let newState: CashlinkState = CashlinkState.UNCHARGED;
        if (hasPendingFundingTx) {
            newState = CashlinkState.CHARGING;
        }
        if (balance) {
            newState = CashlinkState.UNCLAIMED;
        }
        if (hasOurPendingClaimingTx) {
            // Re-check with updated hasOurPendingClaimingTx.
            newState = CashlinkState.CLAIMING;
        }
        if (hasOurChainClaimingTx
            || (hasChainFundingTx && (hasAnyPendingClaimingTx || hasAnyChainClaimingTx)
                && !balance && !hasPendingFundingTx && !hasOurPendingClaimingTx)
        ) {
            // User already claimed the cashlink and is not allowed to claim again or it had been funded but no funds
            // are left and it's not being recharged or still being claimed. Also checking whether we know at least one
            // claiming tx instead of relying on empty balance to avoid CLAIMED state after funding if the chain funding
            // tx is already known but balance update was not triggered yet.
            newState = CashlinkState.CLAIMED;
        }

        this._updateState(newState);
    }

    private async _getPendingTransactions(): Promise<[
        /* pending transactions */ CashlinkTransaction[],
        /* whether there is a pending funding tx */ boolean,
        /* whether there is a pending claiming tx to us */ boolean,
    ]> {
        const userAddresses = this._getUserAddresses();
        const pendingTransactions = await this._currencyHandler.getPendingTransactions();

        const hasPendingFundingTx = pendingTransactions.some(
            (tx) => tx.recipient === this.address);
        // A claim by us which is currently in progress counts as a pending claiming transaction to us, too, as its
        // transaction is on its way, even if it is not among the pending transactions (yet).
        const hasOurPendingClaimingTx = this._isClaiming || pendingTransactions.some(
            (tx) => tx.sender === this.address && userAddresses.has(tx.recipient!));

        return [pendingTransactions, hasPendingFundingTx, hasOurPendingClaimingTx];
    }

    private async _registerTransactionListener() {
        this._transactionListenerError = null;
        try {
            await this._currencyHandler.awaitConsensus();
            await this._currencyHandler.registerTransactionListener((transaction: CashlinkTransaction) => {
                if (transaction.state === 'confirmed'
                    && !this._confirmedTransactions.some((tx) => tx.transactionHash === transaction.transactionHash)) {
                    this._confirmedTransactions.push(transaction);
                }
                this.update().catch(() => { /* see updateError */ });
            });
        } catch (error) {
            this._transactionListenerError = error;
            throw error;
        }
    }

    private async _updateBalance() {
        this._balanceError = null;
        let balance: number;
        try {
            await this._currencyHandler.awaitConsensus();
            balance = await this._currencyHandler.getBalance();
        } catch (error) {
            this._balanceError = error;
            throw error;
        }
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
