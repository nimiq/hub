import { Utf8Tools } from '@nimiq/utils';
import { DetailedPlainTransaction, PlainTransaction, NetworkClient } from '@nimiq/network-client';
import { loadNimiq } from './Helpers';
import { CashlinkState, CashlinkTheme } from './PublicRequestTypes';
import { WalletInfo } from './WalletInfo';

export const CashlinkExtraData = {
    FUNDING:  new Uint8Array([0, 130, 128, 146, 135]), // 'CASH'.split('').map(c => c.charCodeAt(0) + 63)
    CLAIMING: new Uint8Array([0, 139, 136, 141, 138]), // 'LINK'.split('').map(c => c.charCodeAt(0) + 63)
};

export interface CashlinkEntry {
    address: string;
    keyPair: Uint8Array;
    value: number;
    fee?: number;
    message: string;
    state: CashlinkState;
    timestamp: number;
    theme?: CashlinkTheme;
    contactName?: string; /** unused for now */
}

class Cashlink {
    get value() {
        return this._value || 0;
    }

    set value(value: number) {
        if (this._value && (this._immutable || this.state !== CashlinkState.UNCHARGED)) {
            throw new Error('Cannot set value, Cashlink is immutable');
        }
        if (!Nimiq.NumberUtils.isUint64(value) || value === 0) throw new Error('Malformed Cashlink value');
        this._value = value;
    }

    set fee(fee: number) {
        if (this.state === CashlinkState.CLAIMED) {
            console.warn('Setting a fee will typically have no effect anymore as Cashlink is already claimed');
        } else if (fee && fee < Cashlink.MIN_PAID_TRANSACTION_FEE) {
            console.warn(`Fee of ${Nimiq.Policy.lunasToCoins(fee)} is too low to count as paid transaction`);
        } else if (fee < this.suggestedFee) {
            console.warn(`Fee of ${Nimiq.Policy.lunasToCoins(fee)} is smaller than suggested fee of `
                + Nimiq.Policy.lunasToCoins(this.fee));
        }
        this._fee = fee;
    }

    get fee() {
        return this._fee !== null ? this._fee : this.suggestedFee;
    }

    get suggestedFee() {
        if (
            // Cashlink balance was apparently specifically setup such that every claiming transaction can be a paid one
            (this.balance && this.balance % (this.value + Cashlink.MIN_PAID_TRANSACTION_FEE) === 0)
            // Many parallel claims are happening right now. Because free transactions per sender are limited to 10 per
            // block (Mempool.FREE_TRANSACTIONS_PER_SENDER_MAX) we better send further transactions with a fee. Using
            // 5 as cutoff instead of 10 as not all transactions might have been propagated by the network to us yet.
            // Note that this._pendingTransactions could technically also include pending cashlink funding transactions
            // which should not count towards pending claims but we can ignore this fact here.
            || this._pendingTransactions.length >= 5
        ) {
            return Cashlink.MIN_PAID_TRANSACTION_FEE;
        }
        return 0;
    }

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

    get message() {
        return Utf8Tools.utf8ByteArrayToString(this._messageBytes);
    }

    set message(message: string) {
        if (this._messageBytes.byteLength && (this._immutable || this.state !== CashlinkState.UNCHARGED)) {
            throw new Error('Cannot set message, Cashlink is immutable');
        }
        const messageBytes = Utf8Tools.stringToUtf8ByteArray(message);
        if (!Nimiq.NumberUtils.isUint8(messageBytes.byteLength)) throw new Error('Cashlink message is too long');
        this._messageBytes = messageBytes;
    }

    get theme() {
        return this._theme || Cashlink.DEFAULT_THEME;
    }

    set theme(theme: CashlinkTheme) {
        if (this._theme && (this._immutable || this.state !== CashlinkState.UNCHARGED)) {
            throw new Error('Cannot set theme, Cashlink is immutable');
        }
        if (!Nimiq.NumberUtils.isUint8(theme)) {
            throw new Error('Invalid Cashlink theme');
        }
        this._theme = !Object.values(CashlinkTheme).includes(theme)
            ? CashlinkTheme.UNSPECIFIED // lenient fallback
            : theme;
    }

    get hasEncodedTheme() {
        return !!this._theme;
    }

    public static async create(): Promise<Cashlink> {
        await loadNimiq();
        const keyPair = Nimiq.KeyPair.derive(Nimiq.PrivateKey.generate());
        return new Cashlink(keyPair, keyPair.publicKey.toAddress());
    }

    public static async parse(str: string): Promise<Cashlink | null> {
        if (!str) return null;
        try {
            str = str.replace(/~/g, '').replace(/=*$/, (match) => new Array(match.length).fill('.').join(''));
            const buf = Nimiq.BufferUtils.fromBase64Url(str);
            await loadNimiq();
            const keyPair = Nimiq.KeyPair.derive(Nimiq.PrivateKey.unserialize(buf));
            const value = buf.readUint64();
            let message: string;
            if (buf.readPos === buf.byteLength) {
                message = '';
            } else {
                const messageLength = buf.readUint8();
                const messageBytes = buf.read(messageLength);
                message = Utf8Tools.utf8ByteArrayToString(messageBytes);
            }
            let theme: CashlinkTheme | undefined;
            if (buf.readPos < buf.byteLength) {
                theme = buf.readUint8();
            }

            return new Cashlink(
                keyPair,
                keyPair.publicKey.toAddress(),
                value,
                undefined, // fee
                message,
                CashlinkState.UNKNOWN,
                theme,
            );
        } catch (e) {
            console.error('Error parsing Cashlink:', e);
            return null;
        }
    }

    public static fromObject(object: CashlinkEntry): Cashlink {
        return new Cashlink(
            Nimiq.KeyPair.unserialize(new Nimiq.SerialBuffer(object.keyPair)),
            Nimiq.Address.fromString(object.address),
            object.value,
            object.fee,
            object.message,
            object.state,
            object.theme,
            // @ts-ignore `timestamp` was called `date` before and was live in the mainnet.
            object.timestamp || object.date,
            object.contactName,
        );
    }

    private static readonly LAST_CLAIMED_MULTI_CASHLINKS_STORAGE_KEY = 'cashlink-last-claimed-multi-cashlinks';

    private static _getLastClaimedMultiCashlinks(): Nimiq.Address[] {
        try {
            const storedLastClaimedMultiCashlinks = localStorage[Cashlink.LAST_CLAIMED_MULTI_CASHLINKS_STORAGE_KEY];
            if (!storedLastClaimedMultiCashlinks) return [];
            return JSON.parse(storedLastClaimedMultiCashlinks)
                .map((addressBase64: string) => Nimiq.Address.fromBase64(addressBase64));
        } catch (e) {
            return [];
        }
    }

    private static _setLastClaimedMultiCashlink(address: Nimiq.Address) {
        // restrict to last 5 entries, store as base64 and omit trailing padding to save storage space
        window.localStorage[Cashlink.LAST_CLAIMED_MULTI_CASHLINKS_STORAGE_KEY] = JSON.stringify([
            address,
            ...Cashlink._getLastClaimedMultiCashlinks(),
        ].slice(0, 5).map((addr) => addr.toBase64().replace(/=+$/, '')));
    }

    /**
     * Cashlink balance in luna, with pending outgoing transactions subtracted
     */
    public balance: number | null = null;

    private readonly _getNetwork: () => Promise<NetworkClient>;
    private _networkClientResolver!: (client: NetworkClient) => void;
    private readonly _immutable: boolean;
    private readonly _eventListeners: {[type: string]: Array<(data: any) => void>} = {};
    private _messageBytes: Uint8Array = new Uint8Array(0);
    private _value: number | null = null;
    private _fee: number | null = null;
    private _theme: CashlinkTheme = CashlinkTheme.UNSPECIFIED; // note that UNSPECIFIED equals to 0 and is thus falsy
    private _getUserAddresses: () => Set<string>;
    private _knownTransactions: DetailedPlainTransaction[] = [];
    private _pendingTransactions: Array<Partial<DetailedPlainTransaction>> = [];
    private _detectStateTimeout: number = -1;

    constructor(
        public keyPair: Nimiq.KeyPair,
        public address: Nimiq.Address,
        value?: number,
        fee?: number,
        message?: string,
        public state: CashlinkState = CashlinkState.UNCHARGED,
        theme?: CashlinkTheme,
        public timestamp: number = Math.floor(Date.now() / 1000),
        public contactName?: string, /** unused for now */
    ) {
        const networkPromise = new Promise<NetworkClient>((resolve) => {
            // Save resolver function for when the network client gets assigned
            this._networkClientResolver = resolve;
        });
        this._getNetwork = () => networkPromise;
        this._getUserAddresses = () => new Set(); // dummy, actual method will be set via setDependencies

        if (value) this.value = value;
        if (fee) this.fee = fee;
        if (message) this.message = message;
        if (theme) this.theme = theme;

        this._immutable = !!(value || message || theme);

        this._getNetwork().then((network: NetworkClient) => {
            const userFriendlyAddress = this.address.toUserFriendlyAddress();

            // When not yet established, the balance will be updated by the nano-api as soon
            // as we have consensus, because subscribing (below) triggers a balance check.
            if (network.consensusState === 'established') {
                network.getBalance(userFriendlyAddress).then(this._onBalancesChanged.bind(this));
            }

            // Register network event handlers.
            // BALANCES_CHANGED: notifications for balance changes with pending outgoing txs subtracted by nano-api.
            network.on(NetworkClient.Events.BALANCES_CHANGED, this._onBalancesChanged.bind(this));
            // TRANSACTION: covers TRANSACTION_PENDING (for pending incoming transactions which do not trigger a balance
            // change), TRANSACTION_MINED (for previously pending outgoing tx which do not trigger a second balance
            // change), TRANSACTION_EXPIRED (for treatment of expired pending transactions) and TRANSACTION_RELAYED
            // (which we don't need because pending outgoing transactions already lead to a balance update) of old api.
            network.on(NetworkClient.Events.TRANSACTION, this._onTransactionChanged.bind(this));

            // Triggers a BALANCES_CHANGED event if this is the first time this address is subscribed
            network.subscribe(userFriendlyAddress);
        });

        // Run initial state detection (awaits consensus in detectState())
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
        if (Cashlink._getLastClaimedMultiCashlinks().some((address) => address.equals(this.address))) {
            this._updateState(CashlinkState.CLAIMED);
            return;
        }

        // Avoid double invocations from events triggered at the same time. Instead, wait a little bit for all events
        // and their data to hopefully have processed on the network side, such that we don't work with outdated data.
        if (this._detectStateTimeout !== -1) return;
        await new Promise((resolve) => this._detectStateTimeout = window.setTimeout(resolve, 100));
        this._detectStateTimeout = -1;

        await this._awaitConsensus();

        const cashlinkAddress = this.address.toUserFriendlyAddress();
        const userAddresses = this._getUserAddresses();

        let balance = await this._awaitBalance(); // balance with pending outgoing transactions subtracted by nano-api
        let pendingFundingTx: Partial<DetailedPlainTransaction> | undefined;
        let ourPendingClaimingTx: Partial<DetailedPlainTransaction> | undefined;
        [this._pendingTransactions, pendingFundingTx, ourPendingClaimingTx] = await this._getPendingTransactions();
        let ourKnownClaimingTx = this._knownTransactions.find( // for now based on old known transactions
            (tx) => tx.sender === cashlinkAddress && userAddresses.has(tx.recipient));

        if (ourPendingClaimingTx) {
            // Can exit early as if the user is currently claiming the cashlink, it can't be in CLAIMED state yet, as
            // the transaction is still pending and we don't allow claiming if the cashlink was last in CLAIMED state
            this._updateState(CashlinkState.CLAIMING);
            return;
        }
        if (this.state === CashlinkState.CLAIMED && (ourKnownClaimingTx || (!balance && !pendingFundingTx))) {
            // Can exit early as either the user already claimed the cashlink and is not allowed to claim again or it is
            // empty and not refilled and already reached CLAIMED state, i.e. is not just empty because it is UNCHARGED.
            return;
        }

        const knownTransactionReceipts = new Map(this._knownTransactions.map((tx) => [tx.hash, tx.blockHash!]));

        const transactionHistory = await (await this._getNetwork()).requestTransactionHistory(
            cashlinkAddress,
            knownTransactionReceipts,
        );
        this._knownTransactions = this._knownTransactions.concat(transactionHistory.newTransactions);

        const knownFundingTx = this._knownTransactions.find(
            (tx) => tx.recipient === cashlinkAddress);
        ourKnownClaimingTx = ourKnownClaimingTx || this._knownTransactions.find( // update with new transactions
            (tx) => tx.sender === cashlinkAddress && userAddresses.has(tx.recipient));
        const anyKnownClaimingTx = ourKnownClaimingTx || this._knownTransactions.find(
            (tx) => tx.sender === cashlinkAddress);

        // Update balance and pending transactions after fetching transaction history as they might have changed in the
        // meantime. This update is cheap and quick.
        [balance, [this._pendingTransactions, pendingFundingTx, ourPendingClaimingTx]] = await Promise.all([
            this._awaitBalance(),
            this._getPendingTransactions(),
        ]);
        const anyPendingClaimingTx = ourPendingClaimingTx || this._pendingTransactions.find(
            (tx) => tx.sender === cashlinkAddress);

        // Detect new state by a sequence of checks from UNCHARGED, CHARGING, UNCLAIMED, CLAIMING to CLAIMED states.
        // Note that cashlinks that already reached a later state in a previous detectState, can also go back to earlier
        // states again, e.g. by pending funding/claiming txs expiring, cashlink recharging or blockchain rebranching.
        // Blockchain rebranching is however currently not handled as we don't evict transactions that were forked away
        // from _knownTransactions. These transactions automatically end up in the mempool again though and should
        // usually get confirmed again (but not necessarily, if mempool limits are exceeded).
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
        if (ourKnownClaimingTx
            || (knownFundingTx && (anyPendingClaimingTx || anyKnownClaimingTx)
                && !balance && !pendingFundingTx && !ourPendingClaimingTx)
        ) {
            // User already claimed the cashlink and is not allowed to claim again or it had been funded but no funds
            // are left and it's not being recharged or still being claimed. Also checking whether we know at least one
            // claiming tx instead of relying on empty balance to avoid CLAIMED state after funding if knownFundingTx is
            // already known but balance update was not triggered yet.
            newState = CashlinkState.CLAIMED;
        }

        this._updateState(newState);
    }

    public toObject(includeOptional: boolean = true): CashlinkEntry {
        const result: CashlinkEntry = {
            keyPair: new Uint8Array(this.keyPair.serialize()),
            address: this.address.toUserFriendlyAddress(),
            value: this.value,
            message: this.message,
            state: this.state,
            theme: this._theme,
            timestamp: this.timestamp,
        };
        if (includeOptional) {
            if (this._fee !== null) {
                result.fee = this._fee;
            }
            if (this.contactName) {
                result.contactName = this.contactName;
            }
        }
        return result;
    }

    public render() {
        const buf = new Nimiq.SerialBuffer(
            /*key*/ this.keyPair.privateKey.serializedSize +
            /*value*/ 8 +
            /*message length*/ (this._messageBytes.byteLength || this._theme ? 1 : 0) +
            /*message*/ this._messageBytes.byteLength +
            /*theme*/ (this._theme ? 1 : 0),
        );

        this.keyPair.privateKey.serialize(buf);
        buf.writeUint64(this.value);
        if (this._messageBytes.byteLength || this._theme) {
            buf.writeUint8(this._messageBytes.byteLength);
            buf.write(this._messageBytes);
        }
        if (this._theme) {
            buf.writeUint8(this._theme);
        }

        let result = Nimiq.BufferUtils.toBase64Url(buf);
        // replace trailing . by = because of URL parsing issues on iPhone.
        result = result.replace(/\./g, '=');
        // iPhone also has a problem to parse long words with more then 300 chars in a URL in WhatsApp
        // (and possibly others). Therefore we break the words by adding a ~ every 256 characters in long words.
        result = result.replace(/[A-Za-z0-9_]{257,}/g, (match) => match.replace(/.{256}/g, '$&~'));

        return result;
    }

    public getFundingDetails(): {
        layout: 'cashlink',
        recipient: Nimiq.Address,
        value: number,
        fee: number,
        data: Uint8Array,
        cashlinkMessage: string,
    } {
        return {
            layout: 'cashlink',
            recipient: this.address,
            value: this.value,
            fee: 0, // this.fee is meant for claiming transactions
            data: CashlinkExtraData.FUNDING,
            cashlinkMessage: this.message,
        };
    }

    public async claim(
        recipientAddress: string,
        recipientType: Nimiq.Account.Type = Nimiq.Account.Type.BASIC,
    ): Promise<void> {
        await Promise.all([
            loadNimiq(),
            this.state === CashlinkState.UNKNOWN ? this.detectState() : Promise.resolve(),
        ]);
        if (this.state >= CashlinkState.CLAIMING) {
            throw new Error('Cannot claim, Cashlink has already been claimed');
        }

        // Get latest balance and claimAmount
        const balance = await this._awaitBalance();
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
        const transaction = new Nimiq.ExtendedTransaction(this.address, Nimiq.Account.Type.BASIC,
            recipient, recipientType, claimAmount, fee, await this._getBlockchainHeight(), Nimiq.Transaction.Flag.NONE,
            CashlinkExtraData.CLAIMING);

        const keyPair = this.keyPair;
        const signature = Nimiq.Signature.create(keyPair.privateKey, keyPair.publicKey, transaction.serializeContent());
        transaction.proof = Nimiq.SignatureProof.singleSig(keyPair.publicKey, signature).serialize();

        if (balance > claimAmount + fee) {
            // its a multi-claimable cashlink
            Cashlink._setLastClaimedMultiCashlink(this.address);
        }

        return this._sendTransaction(transaction);
    }

    public on(type: Cashlink.Events, callback: (data: any) => void): void {
        if (!(type in this._eventListeners)) {
            this._eventListeners[type] = [];
        }
        this._eventListeners[type].push(callback);
    }

    public off(type: Cashlink.Events, callback: (data: any) => void): void {
        if (!(type in this._eventListeners)) {
            return;
        }
        const index = this._eventListeners[type].indexOf(callback);
        if (index === -1) {
            return;
        }
        this._eventListeners[type].splice(index, 1);
    }

    public fire(type: Cashlink.Events, arg: any): void {
        if (!(type in this._eventListeners)) {
            return;
        }
        this._eventListeners[type].forEach((callback) => callback(arg));
    }

    private async _awaitConsensus(): Promise<void> {
        if ((await this._getNetwork()).consensusState === 'established') return;
        return new Promise(async (resolve) => {
            const handler = async () => {
                (await this._getNetwork()).off(NetworkClient.Events.CONSENSUS_ESTABLISHED, handler);
                resolve();
            };
            (await this._getNetwork()).on(NetworkClient.Events.CONSENSUS_ESTABLISHED, handler);
        });
    }

    private async _awaitBalance(): Promise<number> {
        if (this.balance !== null) return this.balance;
        return new Promise(async (resolve) => {
            const handler = async (balance: number) => {
                this.off(Cashlink.Events.BALANCE_CHANGE, handler);
                resolve(balance);
            };
            this.on(Cashlink.Events.BALANCE_CHANGE, handler);
        });
    }

    private async _sendTransaction(transaction: Nimiq.Transaction): Promise<void> {
        await this._awaitConsensus();
        try {
            const proof = Nimiq.SignatureProof.unserialize(new Nimiq.SerialBuffer(transaction.proof));
            await (await this._getNetwork()).relayTransaction({
                sender: transaction.sender.toUserFriendlyAddress(),
                senderPubKey: proof.publicKey.serialize(),
                recipient: transaction.recipient.toUserFriendlyAddress(),
                value: Nimiq.Policy.lunasToCoins(transaction.value),
                fee: Nimiq.Policy.lunasToCoins(transaction.fee),
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
        return (await this._getNetwork()).headInfo.height;
    }

    private async _getPendingTransactions(): Promise<[
        Array<Partial<DetailedPlainTransaction>>,
        Partial<DetailedPlainTransaction> | undefined,
        Partial<DetailedPlainTransaction> | undefined,
    ]> {
        await this._awaitConsensus();
        const network = await this._getNetwork();
        const cashlinkAddress = this.address.toUserFriendlyAddress();
        const userAddresses = this._getUserAddresses();
        const pendingTransactions = [
            ...network.pendingTransactions,
            ...network.relayedTransactions,
        ].filter((tx) => tx.sender === cashlinkAddress || tx.recipient === cashlinkAddress);

        const pendingFundingTx = pendingTransactions.find(
            (tx) => tx.recipient === cashlinkAddress);
        const ourPendingClaimingTx = pendingTransactions.find(
            (tx) => tx.sender === cashlinkAddress && userAddresses.has(tx.recipient!));

        return [pendingTransactions, pendingFundingTx, ourPendingClaimingTx];
    }

    private _onTransactionChanged(transaction: PlainTransaction): void {
        const cashlinkAddress = this.address.toUserFriendlyAddress();
        if (transaction.recipient !== cashlinkAddress && transaction.sender !== cashlinkAddress) return;
        this.detectState();
    }

    private _onBalancesChanged(balances: Map<string, number>) {
        const address = this.address.toUserFriendlyAddress();

        if (!balances.has(address)) return;

        this.balance = Nimiq.Policy.coinsToLunas(balances.get(address)!);
        this.fire(Cashlink.Events.BALANCE_CHANGE, this.balance);
        // Always run state detection when the balance changes,
        // to catch state changes even when the transaction events
        // have not been recognized (can happen when an incoming
        // transaction gets mined before it's pending state is
        // broadcasted to this client).
        this.detectState();
    }

    private _updateState(state: CashlinkState) {
        if (state === this.state) return;
        this.state = state;
        this.fire(Cashlink.Events.STATE_CHANGE, this.state);
    }
}

namespace Cashlink {
    export enum Events {
        BALANCE_CHANGE = 'balance-change',
        STATE_CHANGE = 'state-change',
    }

    // To be updated with the seasons.
    export const DEFAULT_THEME = Date.now() < new Date('Tue, 13 Apr 2020 23:59:00 GMT-12').valueOf()
        ? CashlinkTheme.EASTER
        : CashlinkTheme.STANDARD;

    // (size of extended tx + cashlink extra data) * Nimiq.Mempool.TRANSACTION_RELAY_FEE_MIN which is 1. We can't use
    // TRANSACTION_RELAY_FEE_MIN as constant because Mempool is not included in Nimiq core offline build.
    export const MIN_PAID_TRANSACTION_FEE = 171;
}

export default Cashlink;
