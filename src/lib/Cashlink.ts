import { Utf8Tools } from '@nimiq/utils';
import { NetworkClient } from './NetworkClient';
import { CashlinkTheme } from '../../client/PublicRequestTypes';
import { WalletInfo } from './WalletInfo';

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

export interface CashlinkEntry {
    address: string;
    keyPair: Uint8Array;
    value: number;
    fee?: number;
    message: string;
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
        }
        this._fee = fee;
    }

    get fee() {
        return this._fee || 0;
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

    public static create(): Cashlink {
        const keyPair = Nimiq.KeyPair.derive(Nimiq.PrivateKey.generate());
        return new Cashlink(keyPair, keyPair.publicKey.toAddress());
    }

    public static parse(str: string): Cashlink | null {
        if (!str) return null;
        try {
            str = str.replace(/~/g, '').replace(/=*$/, (match) => new Array(match.length).fill('.').join(''));
            const buf = Nimiq.BufferUtils.fromBase64Url(str);
            const privateKeyBytes = buf.read(Nimiq.PrivateKey.SIZE);
            const keyPair = Nimiq.KeyPair.derive(Nimiq.PrivateKey.deserialize(privateKeyBytes));
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
            Nimiq.KeyPair.deserialize(new Nimiq.SerialBuffer(object.keyPair)),
            Nimiq.Address.fromString(object.address),
            object.value,
            object.fee,
            object.message,
            CashlinkState.UNKNOWN,
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
            return JSON.parse(storedLastClaimedMultiCashlinks).map((addressBase64: string) => {
                const addressBytes = Nimiq.BufferUtils.fromBase64(addressBase64);
                return new Nimiq.Address(addressBytes);
            });
        } catch (e) {
            return [];
        }
    }

    private static _setLastClaimedMultiCashlink(address: Nimiq.Address) {
        // restrict to last 5 entries, store as base64 and omit trailing padding to save storage space
        window.localStorage[Cashlink.LAST_CLAIMED_MULTI_CASHLINKS_STORAGE_KEY] = JSON.stringify([
            address,
            ...Cashlink._getLastClaimedMultiCashlinks(),
        ].slice(0, 5).map((addr) => {
            const addressBytes = addr.serialize();
            const addressBase64 = Nimiq.BufferUtils.toBase64(addressBytes);
            return addressBase64.replace(/=+$/, '');
        }));
    }

    /**
     * Cashlink balance in luna
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
    private _chainTransactions: Nimiq.PlainTransactionDetails[] = []; // transactions already included on chain
    private _detectStateTimeout: number = -1;

    constructor(
        public keyPair: Nimiq.KeyPair,
        public address: Nimiq.Address,
        value?: number,
        fee?: number,
        message?: string,
        public state: CashlinkState = CashlinkState.UNKNOWN,
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

        let balance = await this._awaitBalance();
        let pendingTransactions: Array<Partial<Nimiq.PlainTransactionDetails>>;
        let pendingFundingTx: Partial<Nimiq.PlainTransactionDetails> | undefined;
        let ourPendingClaimingTx: Partial<Nimiq.PlainTransactionDetails> | undefined;
        [pendingTransactions, pendingFundingTx, ourPendingClaimingTx] = await this._getPendingTransactions();
        let ourChainClaimingTx = this._chainTransactions.find( // for now based on previously known transactions
            (tx) => tx.sender === cashlinkAddress && userAddresses.has(tx.recipient));

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
            cashlinkAddress,
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
            (tx) => tx.recipient === cashlinkAddress);
        ourChainClaimingTx = ourChainClaimingTx || this._chainTransactions.find( // update with new transactions
            (tx) => tx.sender === cashlinkAddress && userAddresses.has(tx.recipient));
        const anyChainClaimingTx = ourChainClaimingTx || this._chainTransactions.find(
            (tx) => tx.sender === cashlinkAddress);

        // Update balance and pending transactions after fetching transaction history as they might have changed in the
        // meantime. This update is cheap and quick.
        [balance, [pendingTransactions, pendingFundingTx, ourPendingClaimingTx]] = await Promise.all([
            this._awaitBalance(),
            this._getPendingTransactions(),
        ]);
        const anyPendingClaimingTx = ourPendingClaimingTx || pendingTransactions.find(
            (tx) => tx.sender === cashlinkAddress);

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

    public toObject(includeOptional: boolean = true): CashlinkEntry {
        const result: CashlinkEntry = {
            keyPair: this.keyPair.serialize(),
            address: this.address.toUserFriendlyAddress(),
            value: this.value,
            message: this.message,
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

        buf.write(this.keyPair.privateKey.serialize());
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
        recipientData: Uint8Array,
        cashlinkMessage: string,
    } {
        return {
            layout: 'cashlink',
            recipient: this.address,
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
            this.address, Nimiq.AccountType.Basic, new Uint8Array(0),
            recipient, recipientType, CashlinkExtraData.CLAIMING,
            BigInt(claimAmount), BigInt(fee),
            Nimiq.TransactionFlag.None,
            blockchainHeight,
            networkId,
        );

        const keyPair = this.keyPair;
        const signature = Nimiq.Signature.create(keyPair.privateKey, keyPair.publicKey, transaction.serializeContent());
        transaction.proof = Nimiq.SignatureProof.singleSig(keyPair.publicKey, signature).serialize();

        if (balance > claimAmount + fee) {
            // Remember multi-claimable Cashlink as claimed.
            Cashlink._setLastClaimedMultiCashlink(this.address);
        }

        await this._sendTransaction(transaction);
        if (this.state < CashlinkState.CLAIMING) {
            this._updateState(CashlinkState.CLAIMING);
        }
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
        const network = await this._getNetwork();
        await network.awaitConsensus();
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
        // const cashlinkAddress = this.address.toUserFriendlyAddress();
        // const userAddresses = this._getUserAddresses();
        // const pendingTransactions = [
        //     ...network.pendingTransactions,
        //     ...network.relayedTransactions,
        // ].filter((tx) => tx.sender === cashlinkAddress || tx.recipient === cashlinkAddress);
        //
        // const pendingFundingTx = pendingTransactions.find(
        //     (tx) => tx.recipient === cashlinkAddress);
        // const ourPendingClaimingTx = pendingTransactions.find(
        //     (tx) => tx.sender === cashlinkAddress && userAddresses.has(tx.recipient!));
        //
        // return [pendingTransactions, pendingFundingTx, ourPendingClaimingTx];
    }

    private async _onTransactionChanged(transaction: Nimiq.PlainTransactionDetails): Promise<void> {
        const cashlinkAddress = this.address.toUserFriendlyAddress();
        if (transaction.recipient !== cashlinkAddress && transaction.sender !== cashlinkAddress) return;
        if ((transaction.state === 'included' || transaction.state === 'confirmed')
            && !this._chainTransactions.some((tx) => tx.transactionHash === transaction.transactionHash)) {
            this._chainTransactions.push(transaction);
        }
        await this._updateBalance();
        await this.detectState();
    }

    private async _updateBalance() {
        const network = await this._getNetwork();
        const cashlinkAddress = this.address.toUserFriendlyAddress();
        const balances = await network.getBalance([cashlinkAddress]);
        const balance = balances.get(cashlinkAddress);
        if (balance === undefined || balance === this.balance) return;

        this.balance = balance;
        this.fire(Cashlink.Events.BALANCE_CHANGE, balance);
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
}

export default Cashlink;
