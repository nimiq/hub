import { Utf8Tools } from '@nimiq/utils';
import { NetworkClient, DetailedPlainTransaction } from '@nimiq/network-client';
import { SignTransactionRequestLayout } from '@nimiq/keyguard-client';
import { loadNimiq } from './Helpers';
import { CashlinkState } from './PublicRequestTypes';

export const CashlinkExtraData = {
    FUNDING:  new Uint8Array([0, 130, 128, 146, 135]), // 'CASH'.split('').map(c => c.charCodeAt(0) + 63)
    CLAIMING: new Uint8Array([0, 139, 136, 141, 138]), // 'LINK'.split('').map(c => c.charCodeAt(0) + 63)
};

export enum CashlinkType {
    OUTGOING = 0,
    INCOMING = 1,
}

export interface CashlinkEntry {
    address: string;
    keyPair: Uint8Array;
    type: CashlinkType;
    value: number;
    message: string;
    state: CashlinkState;
    date: number;
    originalSender?: string;
    finalRecipient?: string;
    contactName?: string; /** unused for now */
}

export default class Cashlink {
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
        const type = CashlinkType.OUTGOING;
        await loadNimiq();
        const keyPair = Nimiq.KeyPair.derive(Nimiq.PrivateKey.generate());
        return new Cashlink(keyPair, type, keyPair.publicKey.toAddress());
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
                CashlinkType.INCOMING,
                keyPair.publicKey.toAddress(),
                value,
                message,
                CashlinkState.UNKNOWN);
        } catch (e) {
            console.error('Error parsing Cashlink:', e);
            return null;
        }
    }

    public static fromObject(object: CashlinkEntry): Cashlink {
        return new Cashlink(
            Nimiq.KeyPair.unserialize(new Nimiq.SerialBuffer(object.keyPair)),
            object.type,
            Nimiq.Address.fromUserFriendlyAddress(object.address),
            object.value,
            object.message,
            object.state,
            object.date,
            object.originalSender,
            object.finalRecipient,
            object.contactName,
        );
    }

    private $: Promise<NetworkClient>;
    private _networkClientResolver!: (client: NetworkClient) => void;
    private _accountRequests: Map<Nimiq.Address, Promise<number>> = new Map();
    // private _wasEmptiedRequest: Promise<boolean> | null = null;
    private _currentBalance: number = 0;
    private _immutable: boolean;
    private _eventListeners: {[type: string]: Array<(data: any) => void>} = {};
    private _messageBytes: Uint8Array = new Uint8Array(0);
    private _value: number | null = null;
    private _knownTransactions: DetailedPlainTransaction[] = [];

    constructor(
        public keyPair: Nimiq.KeyPair,
        public type: CashlinkType,
        public address: Nimiq.Address,
        value?: number,
        message?: string,
        public state: CashlinkState = CashlinkState.UNCHARGED,
        public date: number = Math.floor(Date.now() / 1000),
        public originalSender?: string,
        public finalRecipient?: string,
        public contactName?: string, /** unused for now */
    ) {
        this.$ = new Promise((resolve) => {
            this._networkClientResolver = resolve;
        });

        if (value) this.value = value;
        if (message) this.message = message;

        this._immutable = !!(value || message);

        this.$.then((network: NetworkClient) => {
            if (this.state !== CashlinkState.CLAIMED) {
                // value will be updated as soon as we have consensus (in _onPotentialBalanceChange)
                // and a confirmed-amount-changed event gets fired
                if (network.consensusState === 'established') {
                    this.getAmount().then((balance: number) => this._currentBalance = balance);
                }

                network.on(NetworkClient.Events.TRANSACTION_PENDING, this._onTransactionAddedOrRelayed.bind(this));
                network.on(NetworkClient.Events.TRANSACTION_RELAYED, this._onTransactionAddedOrRelayed.bind(this));
                network.on(NetworkClient.Events.HEAD_CHANGE, this._onHeadChanged.bind(this));
                network.on(NetworkClient.Events.CONSENSUS_ESTABLISHED, this._onPotentialBalanceChange.bind(this));

                network.subscribe(this.address.toUserFriendlyAddress());
            }
        });

        this.detectState();
    }

    public async detectState() {
        if (this.state === CashlinkState.CLAIMED) return;

        const knownTransactionReceipts = new Map([[this.address.toUserFriendlyAddress(), new Map(
            this._knownTransactions.map((tx) => [tx.hash, tx.blockHash!]))]]);

        await this._awaitConsensus();

        const [transactionHistory, pendingTransactions, balance] = await Promise.all([
            (await this.$).requestTransactionHistory(this.address.toUserFriendlyAddress(), knownTransactionReceipts),
            [...(await this.$).pendingTransactions, ...(await this.$).relayedTransactions],
            this.getAmount(),
        ]);
        this._knownTransactions = this._knownTransactions.concat(transactionHistory.newTransactions);

        let newState: CashlinkState = this.state;

        switch (this.state) {
            case CashlinkState.UNKNOWN:
                if (!balance && !this._knownTransactions.length && !pendingTransactions.length) {
                    newState = CashlinkState.UNCHARGED;
                }
            case CashlinkState.UNCHARGED:
                const fundingTx = pendingTransactions.find(
                    (tx) => tx.recipient === this.address.toUserFriendlyAddress());
                if (fundingTx) {
                    this.originalSender = fundingTx.sender!;
                    newState = CashlinkState.CHARGING;
                }
            case CashlinkState.CHARGING:
                if (this._knownTransactions[0]) {
                    if (this.originalSender && this.originalSender !== this._knownTransactions[0].sender) {
                        console.warn(
                            'Previously detected original sender is different from sender of first tx',
                            this.originalSender,
                            this._knownTransactions[0].sender,
                        );
                    } else {
                        this.originalSender = this._knownTransactions[0].sender;
                    }
                    newState = CashlinkState.UNCLAIMED;
                } else break; // If no transactions are found, no further checks are necessary
            case CashlinkState.UNCLAIMED:
                const claimingTx = pendingTransactions.find((tx) => tx.sender === this.address.toUserFriendlyAddress());
                if (claimingTx) {
                    this.finalRecipient = claimingTx.recipient!;
                    newState = CashlinkState.CLAIMING;
                }
            case CashlinkState.CLAIMING:
                for (let i = 1; i < this._knownTransactions.length; i++) {
                    if (this._knownTransactions[i].sender === this.address.toUserFriendlyAddress()) {
                        this.finalRecipient = this._knownTransactions[i].recipient;
                        newState = CashlinkState.CLAIMED;
                        break;
                    }
                }
            default: break;
        }

        if (newState !== this.state) this._updateState(newState);
    }

    public toObject(): CashlinkEntry {
        return {
            address: this.address.toUserFriendlyAddress(),
            keyPair: new Uint8Array(this.keyPair.serialize()),
            type: this.type,
            value: this.value,
            message: this.message,
            state: this.state,
            date: this.date,
            originalSender: this.originalSender,
            finalRecipient: this.finalRecipient,
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
            recipient: new Uint8Array(this.address.serialize()),
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
        // if (this.state >= CashlinkState.CLAIMING) {
        //     throw new Error('Cashlink has already been claimed');
        // }

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
        const proof = new Uint8Array(Nimiq.SignatureProof.singleSig(keyPair.publicKey, signature).serialize());

        transaction.proof = proof;

        await this._executeUntilSuccess(async () => {
            await this._sendTransaction(transaction);
        });
    }

    public async getAmount(includeUnconfirmed?: boolean): Promise<number> {
        let balance = await this._getBalance();
        if (includeUnconfirmed) {
            const transferWalletAddress = this.address;
            for (const transaction of [...(await this.$).pendingTransactions, ...(await this.$).relayedTransactions]) {
                const sender = transaction.sender!;
                const recipient = transaction.recipient!;
                if (recipient === transferWalletAddress.toUserFriendlyAddress()) {
                    // money sent to the transfer wallet
                    balance += transaction.value!;
                    this.originalSender = sender;
                    this._updateState(CashlinkState.CHARGING);
                } else if (sender === transferWalletAddress.toUserFriendlyAddress()) {
                    balance -= transaction.value! + transaction.fee!;
                    this.finalRecipient = recipient;
                    this._updateState(CashlinkState.CLAIMING);
                }
            }
        }
        return balance;
    }

    // public async wasEmptied(): Promise<boolean> {
    //     if (this.state === CashlinkState.CLAIMED) return true;

    //     this._wasEmptiedRequest = this._wasEmptiedRequest || this._executeUntilSuccess<boolean>(async () => {
    //         await this._awaitConsensus();
    //         const [transactionHistory, balance] = await Promise.all([
    //             (await this.$).requestTransactionHistory(this._keyPair.address.toUserFriendlyAddress(), new Map()),
    //             this.getAmount(),
    //         ]);
    //         const transactions = transactionHistory.newTransactions;

    //         let state = this.state;

    //         // Find original sender
    //         if (!this.originalSender && transactions[0]) {
    //             this.originalSender = transactions[0].sender;
    //             state = CashlinkState.UNCLAIMED;
    //         }

    //         // Find final recipient
    //         if (!this.finalRecipient)
    //         for (let i = 1; i < transactions.length; i++) {
    //             if (transactions[i].sender === this.address.toUserFriendlyAddress()) {
    //                 this.finalRecipient = transactions[i].recipient;
    //                 break;
    //             }
    //         }

    //         // considered emptied if value is 0 and account has been used
    //         if (balance === 0 && transactions.length > 0) {
    //             state = CashlinkState.CLAIMED;
    //             this._updateState(state);
    //             return true;
    //         }
    //         return false;
    //     });

    //     return this._wasEmptiedRequest;
    // }

    public on(type: string, callback: (data: any) => void): void {
        if (!(type in this._eventListeners)) {
            this._eventListeners[type] = [];
        }
        this._eventListeners[type].push(callback);
    }

    public off(type: string, callback: (data: any) => void): void {
        if (!(type in this._eventListeners)) {
            return;
        }
        const index = this._eventListeners[type].indexOf(callback);
        if (index === -1) {
            return;
        }
        this._eventListeners[type].splice(index, 1);
    }

    public fire(type: string, arg: any): void {
        if (!(type in this._eventListeners)) {
            return;
        }
        this._eventListeners[type].forEach((callback) => {
            callback(arg);
        });
    }

    private async _awaitConsensus(): Promise<void> {
        if ((await this.$).consensusState === 'established') return;
        return new Promise(async (resolve, reject) => {
            (await this.$).on(NetworkClient.Events.CONSENSUS_ESTABLISHED, resolve);
            // setTimeout(() => reject(new Error('Current network consensus unknown.')), 60 * 1000); // 60 seconds
        });
    }

    private async _sendTransaction(transaction: Nimiq.Transaction): Promise<void> {
        await this._awaitConsensus();
        try {
            const proof = Nimiq.SignatureProof.unserialize(new Nimiq.SerialBuffer(transaction.proof));
            await (await this.$).relayTransaction({
                sender: transaction.sender.toUserFriendlyAddress(),
                senderPubKey: new Uint8Array(proof.publicKey.serialize()),
                recipient: transaction.recipient.toUserFriendlyAddress(),
                value: Nimiq.Policy.lunasToCoins(transaction.value),
                fee: Nimiq.Policy.lunasToCoins(transaction.fee),
                validityStartHeight: transaction.validityStartHeight,
                signature: new Uint8Array(proof.signature.serialize()),
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
                    this._executeUntilSuccess(fn, args).then((result) => resolve(result as T));
                }, 5000);
            });
        }
    }

    private async _getBlockchainHeight(): Promise<number> {
        await this._awaitConsensus();
        return (await this.$).headInfo.height;
    }

    private async _getBalance(address = this.address): Promise<number> {
        let request = this._accountRequests.get(address);
        if (!request) {
            const headHeight = (await this.$).headInfo.height;
            request = this._executeUntilSuccess<number>(async () => {
                await this._awaitConsensus();
                const balances = await (await this.$).getBalance(address.toUserFriendlyAddress());
                if ((await this.$).headInfo.height !== headHeight && this._accountRequests.has(address)) {
                    // the head changed and there was a new account request for the new head, so we return
                    // that newer request
                    return this._accountRequests.get(address)!;
                } else {
                    // the head didn't change (so everything alright) or we don't have a newer request and
                    // just return the result we got for the older head
                    const balance = balances.get(address.toUserFriendlyAddress()) || 0;
                    if (address.equals(this.address)) {
                        this._currentBalance = balance;
                    }
                    return balance;
                }
            });
            this._accountRequests.set(address, request);
        }
        return request;
    }

    private async _onTransactionAddedOrRelayed(transaction: DetailedPlainTransaction): Promise<void> {
        if (transaction.recipient === this.address.toUserFriendlyAddress()
            || transaction.sender === this.address.toUserFriendlyAddress()) {
            const amount = await this.getAmount(true);
            this.fire('unconfirmed-balance-change', amount);
            this.detectState();
        }
    }

    private async _onHeadChanged(o: {height: number}): Promise<void> {
        // balances potentially changed
        this._accountRequests.clear();
        // this._wasEmptiedRequest = null;
        // only interested in final balance
        await this._onPotentialBalanceChange();

        if ((await this.$).consensusState === 'established') this.detectState();
    }

    private async _onPotentialBalanceChange(): Promise<void> {
        if ((await this.$).consensusState !== 'established') {
            // only interested in final balance
            return;
        }
        const oldBalance = this._currentBalance;
        const balance = await this.getAmount();

        if (balance !== oldBalance) {
            this.fire('confirmed-balance-change', balance);
        }

        if (this.state === CashlinkState.CHARGING && balance > 0) {
            this._updateState(CashlinkState.UNCLAIMED);
        }
        if (this.state === CashlinkState.CLAIMING && balance === 0) {
            this._updateState(CashlinkState.CLAIMED);
        }
    }

    private _updateState(state: CashlinkState) {
        this.state = state;
        this.fire('state-change', state);
    }
}
