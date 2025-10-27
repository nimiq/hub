// TODO make detectState private
// TODO lazy load handlers
import Cashlink from './Cashlink';
import {
    createCurrencyHandlerForCashlink,
    CashlinkCurrencyHandlerForCurrency,
    CashlinkTransaction,
} from './CashlinkCurrencyHandler';
import { WalletInfo } from './WalletInfo';
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

    private _currencyHandler!: CashlinkCurrencyHandlerForCurrency<C>;
    private _handlerReady!: Promise<void>;
    private _getUserAddresses: () => Set<string>;
    private _confirmedTransactions: CashlinkTransaction[] = []; // transactions already included on chain
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

        this._getUserAddresses = () => new Set(); // dummy; actual method will be set via setUserWallets

        // Initialize currency handler asynchronously
        this._handlerReady = this._initHandler();

        // Start network updates in background (after handler is ready)
        this._handlerReady.then(() => {
            this._currencyHandler.awaitConsensus().then(() => Promise.all([
                this._updateBalance(),
                this._currencyHandler.registerTransactionListener(this._onTransactionChanged.bind(this)),
            ]));
            // Run initial state detection (awaits consensus and balance in detectState())
            this.detectState();
        });
    }

    public setUserWallets(
        userWallets: WalletInfo[] | (() => WalletInfo[]), // can be a method that returns up-to-date accounts
    ) {
        this._getUserAddresses = () => {
            const wallets = typeof userWallets === 'function' ? userWallets() : userWallets; // get latest wallets
            const currency: CashlinkCurrency = this.currency;
            switch (currency) {
                case CashlinkCurrency.NIM:
                    const accounts = wallets.flatMap((wallet) => [...wallet.accounts.values(), ...wallet.contracts]);
                    return new Set(accounts.map((account) => account.address.toUserFriendlyAddress()));
                case CashlinkCurrency.USDT:
                    // For USDT cashlinks, return empty set (Polygon addresses handled differently)
                    return new Set();
                default:
                    const _exhaustiveCheck: never = currency; // Check to notice unsupported currency at compile time
                    return _exhaustiveCheck;
            }
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
        await this._handlerReady;
        if ((this.constructor as typeof CashlinkInteractive)._getLastClaimedMultiCashlinks().includes(this.address)) {
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
        let pendingFundingTx: CashlinkTransaction | undefined;
        let ourPendingClaimingTx: CashlinkTransaction | undefined;
        [pendingTransactions, pendingFundingTx, ourPendingClaimingTx] = await this._getPendingTransactions();
        let ourChainClaimingTx = this._confirmedTransactions.find( // for now based on previously known transactions
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

        this._confirmedTransactions = await this._currencyHandler.getConfirmedTransactions();

        const chainFundingTx = this._confirmedTransactions.find(
            (tx) => tx.recipient === this.address);
        ourChainClaimingTx = ourChainClaimingTx || this._confirmedTransactions.find( // update with new transactions
            (tx) => tx.sender === this.address && userAddresses.has(tx.recipient));
        const anyChainClaimingTx = ourChainClaimingTx || this._confirmedTransactions.find(
            (tx) => tx.sender === this.address);

        // Update balance and pending transactions after fetching transaction history as they might have changed in the
        // meantime. This update is cheap and quick.
        [balance, [pendingTransactions, pendingFundingTx, ourPendingClaimingTx]] = await Promise.all([
            this.awaitBalance(),
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

    public async getFundingDetails(...args: any[])
        : Promise<ReturnType<CashlinkCurrencyHandlerForCurrency<C>['getCashlinkFundingDetails']>> {
        await this._handlerReady;
        // @ts-ignore - Type mismatch between NIM (no args) and USDT (fromAddress arg) handlers
        return this._currencyHandler.getCashlinkFundingDetails(...args) as any;
    }

    public async claim(recipient: string): Promise<CashlinkTransaction> {
        await this._handlerReady;
        if (this.state === CashlinkState.UNKNOWN) {
            await this.detectState();
        }
        if (this.state >= CashlinkState.CLAIMING) {
            throw new Error('Cannot claim, Cashlink has already been claimed');
        }

        const [balance, transaction] = await Promise.all([
            this.awaitBalance(),
            this._currencyHandler.claimCashlink(recipient),
        ]);

        if (balance > transaction.value + transaction.fee) {
            // Remember multi-claimable Cashlink as claimed.
            (this.constructor as typeof CashlinkInteractive)._setLastClaimedMultiCashlink(this.address);
        }
        if (this.state < CashlinkState.CLAIMING) {
            this._updateState(CashlinkState.CLAIMING);
        }

        return transaction;
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

    private async _getPendingTransactions(): Promise<[
        /* pending transactions */ CashlinkTransaction[],
        /* a pending funding tx */ CashlinkTransaction | undefined,
        /* a pending claiming tx to us */ CashlinkTransaction | undefined,
    ]> {
        await this._handlerReady;
        const userAddresses = this._getUserAddresses();
        const pendingTransactions = await this._currencyHandler.getPendingTransactions();

        const pendingFundingTx = pendingTransactions.find(
            (tx: CashlinkTransaction) => tx.recipient === this.address);
        const ourPendingClaimingTx = pendingTransactions.find(
            (tx: CashlinkTransaction) => tx.sender === this.address && userAddresses.has(tx.recipient!));

        return [pendingTransactions, pendingFundingTx, ourPendingClaimingTx];
    }

    private async _onTransactionChanged(transaction: CashlinkTransaction): Promise<void> {
        if (transaction.state === 'confirmed'
            && !this._confirmedTransactions.some((tx) => tx.transactionHash === transaction.transactionHash)) {
            this._confirmedTransactions.push(transaction);
        }
        await this._updateBalance();
        await this.detectState();
    }

    private async _updateBalance() {
        await this._handlerReady;
        const balance = await this._currencyHandler.getBalance();
        if (balance === undefined || balance === this.balance) return;

        this.balance = balance;
        this.fire(CashlinkInteractive.Events.BALANCE_CHANGE, balance);
    }

    private _updateState(state: CashlinkState) {
        if (state === this.state) return;
        this.state = state;
        this.fire(CashlinkInteractive.Events.STATE_CHANGE, this.state);
    }

    private async _initHandler() {
        this._currencyHandler = await createCurrencyHandlerForCashlink(this);
    }
}

namespace CashlinkInteractive {
    export enum Events {
        BALANCE_CHANGE = 'balance-change',
        STATE_CHANGE = 'state-change',
    }
}

export default CashlinkInteractive;
