import { Utf8Tools } from '@nimiq/utils';
import { NetworkClient, DetailedPlainTransaction } from '@nimiq/network-client';
import { SignTransactionRequestLayout } from '@nimiq/keyguard-client';
import { loadNimiq } from './Helpers';
import { CashlinkState } from './PublicRequestTypes';

export const CashlinkExtraData = {
    FUNDING:  new Uint8Array([0, 130, 128, 146, 135]), // 'CASH'.split('').map(c => c.charCodeAt(0) + 63)
    CLAIMING: new Uint8Array([0, 139, 136, 141, 138]), // 'LINK'.split('').map(c => c.charCodeAt(0) + 63)
};

export interface CashlinkEntry {
    address: string;
    keyPair: Uint8Array;
    value: number;
    message: string;
    state: CashlinkState;
    timestamp: number;
    contactName?: string; /** unused for now */
}

class Cashlink {

    get value() {
        return this._value || 0;
    }

    set value(value: number) {
        if (this._value && (this._immutable || this.state !== CashlinkState.UNCHARGED)) {
            throw new Error('Cashlink is immutable');
        }
        if (!Nimiq.NumberUtils.isUint64(value) || value === 0) throw new Error('Malformed value');
        this._value = value;
    }

    get message() {
        return Utf8Tools.utf8ByteArrayToString(this._messageBytes);
    }

    set message(message) {
        if (this._messageBytes.byteLength && (this._immutable || this.state !== CashlinkState.UNCHARGED)) {
            throw new Error('Cashlink is immutable');
        }
        const messageBytes = Utf8Tools.stringToUtf8ByteArray(message);
        if (!Nimiq.NumberUtils.isUint8(messageBytes.byteLength)) throw new Error('Message is too long');
        this._messageBytes = messageBytes;
    }

    set networkClient(client: NetworkClient) {
        this._networkClientResolver(client);
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
            let message;
            if (buf.readPos === buf.byteLength) {
                message = '';
            } else {
                const messageLength = buf.readUint8();
                const messageBytes = buf.read(messageLength);
                message = Utf8Tools.utf8ByteArrayToString(messageBytes);
            }

            return new Cashlink(
                keyPair,
                keyPair.publicKey.toAddress(),
                value,
                message,
                CashlinkState.UNKNOWN,
            );
        } catch (e) {
            console.error('Error parsing Cashlink:', e);
            return null;
        }
    }

    public static fromObject(object: CashlinkEntry): Cashlink {
        return new Cashlink(
            Nimiq.KeyPair.unserialize(new Nimiq.SerialBuffer(object.keyPair)),
            Nimiq.Address.fromUserFriendlyAddress(object.address),
            object.value,
            object.message,
            object.state,
            // @ts-ignore `timestamp` was called `date` before and was live in the mainnet.
            object.timestamp || object.date,
            object.contactName,
        );
    }

    private _getNetwork: () => Promise<NetworkClient>;
    private _networkClientResolver!: (client: NetworkClient) => void;
    private _balanceRequest: Promise<number> | null = null;
    private _currentBalance: number = 0;
    private _immutable: boolean;
    private _eventListeners: {[type: string]: Array<(data: any) => void>} = {};
    private _messageBytes: Uint8Array = new Uint8Array(0);
    private _value: number | null = null;
    private _knownTransactions: DetailedPlainTransaction[] = [];

    constructor(
        public keyPair: Nimiq.KeyPair,
        public address: Nimiq.Address,
        value?: number,
        message?: string,
        public state: CashlinkState = CashlinkState.UNCHARGED,
        public timestamp: number = Math.floor(Date.now() / 1000),
        public contactName?: string, /** unused for now */
    ) {
        const networkPromise = new Promise<NetworkClient>((resolve) => {
            // Safe resolver function for when the network client gets assigned
            this._networkClientResolver = resolve;
        });
        this._getNetwork = () => networkPromise;

        if (value) this.value = value;
        if (message) this.message = message;

        this._immutable = !!(value || message);

        this._getNetwork().then((network: NetworkClient) => {
            // value will be updated as soon as we have consensus (in _onPotentialBalanceChange)
            // and a Cashlink.Event.CONFIRMED_BALANCE_CHANGE event gets fired
            if (network.consensusState === 'established') {
                this.getAmount(); // Updates _currentBalance internally
            }

            network.on(NetworkClient.Events.TRANSACTION_PENDING, this._onTransactionAddedOrRelayed.bind(this));
            network.on(NetworkClient.Events.TRANSACTION_RELAYED, this._onTransactionAddedOrRelayed.bind(this));
            network.on(NetworkClient.Events.HEAD_CHANGE, this._onHeadChanged.bind(this));
            network.on(NetworkClient.Events.CONSENSUS_ESTABLISHED, this._onPotentialBalanceChange.bind(this));

            network.subscribe(this.address.toUserFriendlyAddress());
        });

        this.detectState();
    }

    public async detectState() {
        await this._awaitConsensus();

        // Getting the balance and pending txs is very efficient for the network
        const balance = await this.getAmount();
        const pendingTransactions = [
            ...(await this._getNetwork()).pendingTransactions,
            ...(await this._getNetwork()).relayedTransactions,
        ];

        const address = this.address.toUserFriendlyAddress();

        const pendingFundingTx = pendingTransactions.find(
            (tx) => tx.recipient === address);
        const pendingClaimingTx = pendingTransactions.find(
            (tx) => tx.sender === address);

        // Only exit if the cashlink is CLAIMED and not currently funded or being funded.
        if (this.state === CashlinkState.CLAIMED && !balance && !pendingFundingTx) return;

        const knownTransactionReceipts = new Map(this._knownTransactions.map((tx) => [tx.hash, tx.blockHash!]));

        const transactionHistory = await (await this._getNetwork()).requestTransactionHistory(
            address,
            knownTransactionReceipts,
        );
        this._knownTransactions = this._knownTransactions.concat(transactionHistory.newTransactions);

        let newState: CashlinkState = this.state;

        const knownFundingTx = this._knownTransactions.find(
            (tx) => tx.recipient === address);
        const knownClaimingTx = this._knownTransactions.find(
            (tx) => tx.sender === address);

        switch (this.state) {
            case CashlinkState.UNKNOWN:
                if (!pendingFundingTx && !knownFundingTx) {
                    newState = CashlinkState.UNCHARGED;
                    break;
                }
            case CashlinkState.UNCHARGED:
                if (pendingFundingTx) {
                    newState = CashlinkState.CHARGING;
                }
            case CashlinkState.CHARGING:
                if (!balance && !pendingFundingTx) {
                    // Handle expired/replaced funding tx
                    newState = CashlinkState.UNCHARGED;
                    // Not break;ing here, because we need to see if the cashlink is already CLAIMED.
                }
                if (knownFundingTx) {
                    newState = CashlinkState.UNCLAIMED;
                } else break; // If no known transactions are found, no further checks are necessary
            case CashlinkState.UNCLAIMED:
                if (pendingClaimingTx) {
                    newState = CashlinkState.CLAIMING;
                }
            case CashlinkState.CLAIMING:
                if (balance) {
                    // Handle recharged/reused cashlink
                    if (!pendingClaimingTx) newState = CashlinkState.UNCLAIMED;
                    break; // If a balance is detected on the cashlink, it cannot be in CLAIMED state.
                }
                if (knownClaimingTx) {
                    newState = CashlinkState.CLAIMED;
                }
            case CashlinkState.CLAIMED:
                // Detect cashlink re-use and chain rebranches
                if (pendingFundingTx) newState = CashlinkState.CHARGING;
                if (balance) newState = CashlinkState.UNCLAIMED;
                if (pendingClaimingTx) newState = CashlinkState.CLAIMING;
        }

        if (newState !== this.state) this._updateState(newState);
    }

    public toObject(): CashlinkEntry {
        return {
            keyPair: new Uint8Array(this.keyPair.serialize()),
            address: this.address.toUserFriendlyAddress(),
            value: this.value,
            message: this.message,
            state: this.state,
            timestamp: this.timestamp,
            contactName: this.contactName,
        };
    }

    public render() {
        const buf = new Nimiq.SerialBuffer(
            /*key*/ this.keyPair.privateKey.serializedSize +
            /*value*/ 8 +
            /*message length*/ (this._messageBytes.byteLength ? 1 : 0) +
            /*message*/ this._messageBytes.byteLength,
        );

        this.keyPair.privateKey.serialize(buf);
        buf.writeUint64(this.value);
        if (this._messageBytes.byteLength) {
            buf.writeUint8(this._messageBytes.byteLength);
            buf.write(this._messageBytes);
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
        layout: SignTransactionRequestLayout,
        recipient: Uint8Array,
        value: number,
        data: Uint8Array,
        cashlinkMessage: string,
    } {
        return {
            layout: 'cashlink',
            recipient: this.address.serialize(),
            value: this.value,
            data: CashlinkExtraData.FUNDING,
            cashlinkMessage: this.message,
        };
    }

    public async claim(
        recipientAddress: string,
        recipientType: Nimiq.Account.Type = Nimiq.Account.Type.BASIC,
        fee = 0,
    ): Promise<void> {
        if (this.state >= CashlinkState.CLAIMING) {
            throw new Error('Cashlink has already been claimed');
        }

        await loadNimiq();

        // Get out the funds. Only the confirmed amount, because we can't request unconfirmed funds.
        const balance = Nimiq.Policy.coinsToLunas(await this._getBalance());
        if (!balance) {
            throw new Error('There is no confirmed balance in this link');
        }
        const recipient = Nimiq.Address.fromUserFriendlyAddress(recipientAddress);
        const transaction = new Nimiq.ExtendedTransaction(this.address, Nimiq.Account.Type.BASIC,
            recipient, recipientType, balance - fee, fee, await this._getBlockchainHeight(),
            Nimiq.Transaction.Flag.NONE, CashlinkExtraData.CLAIMING);

        const keyPair = this.keyPair;
        const signature = Nimiq.Signature.create(keyPair.privateKey, keyPair.publicKey, transaction.serializeContent());
        const proof = Nimiq.SignatureProof.singleSig(keyPair.publicKey, signature).serialize();

        transaction.proof = proof;

        await this._executeUntilSuccess(() => this._sendTransaction(transaction));
    }

    public async getAmount(includeUnconfirmed?: boolean): Promise<number> {
        let balance = await this._getBalance();
        if (includeUnconfirmed) {
            for (const transaction of [
                ...(await this._getNetwork()).pendingTransactions,
                ...(await this._getNetwork()).relayedTransactions,
            ]) {
                const sender = transaction.sender!;
                const recipient = transaction.recipient!;
                if (recipient === this.address.toUserFriendlyAddress()) {
                    // money sent to the transfer wallet
                    balance += transaction.value!;
                } else if (sender === this.address.toUserFriendlyAddress()) {
                    balance -= transaction.value! + transaction.fee!;
                }
            }
        }
        return balance;
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

    private async _executeUntilSuccess<T>(fn: (...args: any[]) => T | Promise<T>, args: any[] = []): Promise<T> {
        try {
            return await fn.apply(this, args);
        } catch (e) {
            console.error(e);
            return new Promise((resolve) => {
                setTimeout(() => {
                    this._executeUntilSuccess(fn, args).then(resolve);
                }, 1000); // Retry in 1 second
            });
        }
    }

    private async _getBlockchainHeight(): Promise<number> {
        await this._awaitConsensus();
        return (await this._getNetwork()).headInfo.height;
    }

    private async _getBalance(): Promise<number> {
        if (this._balanceRequest) return this._balanceRequest;

        const address = this.address.toUserFriendlyAddress();
        const headHeight = await this._getBlockchainHeight();
        return (this._balanceRequest = this._executeUntilSuccess<number>(async () => {
            await this._awaitConsensus();
            const balances = await (await this._getNetwork()).getBalance(address);

            // If the head changed in the meantime, it means the balance request got nulled. But code might still
            // await this outdated promise, so we make sure to return the new promise from this old request.
            if ((await this._getNetwork()).headInfo.height !== headHeight && this._balanceRequest) {
                return this._balanceRequest;
            }

            // Otherwise update the balance and resolve.
            const balance = balances.get(address) || 0;
            this._currentBalance = balance;
            return balance;
        }));
    }

    private async _onTransactionAddedOrRelayed(transaction: DetailedPlainTransaction): Promise<void> {
        if (transaction.recipient === this.address.toUserFriendlyAddress()
            || transaction.sender === this.address.toUserFriendlyAddress()) {
            const amount = await this.getAmount(true);
            this.fire(Cashlink.Events.UNCONFIRMED_BALANCE_CHANGE, amount);
            this.detectState();
        }
    }

    private async _onHeadChanged(o: {height: number}): Promise<void> {
        // balances potentially changed
        this._balanceRequest = null;
        // only interested in final balance
        await this._onPotentialBalanceChange();
    }

    private async _onPotentialBalanceChange(): Promise<void> {
        if ((await this._getNetwork()).consensusState !== 'established') {
            // only interested in final balance
            return;
        }
        const oldBalance = this._currentBalance;
        const balance = await this.getAmount();

        if (balance !== oldBalance) {
            this.fire(Cashlink.Events.CONFIRMED_BALANCE_CHANGE, balance);
        }

        this.detectState();
    }

    private _updateState(state: CashlinkState) {
        this.state = state;
        this.fire(Cashlink.Events.STATE_CHANGE, state);
    }
}

namespace Cashlink {
    export enum Events {
        UNCONFIRMED_BALANCE_CHANGE = 'unconfirmed-balance-change',
        CONFIRMED_BALANCE_CHANGE = 'confirmed-balance-change',
        STATE_CHANGE = 'state-change',
    }
}

export default Cashlink;
