import { Utf8Tools } from '@nimiq/utils';
import { NetworkClient, DetailedPlainTransaction } from '@nimiq/network-client';
// import { KeyguardClient } from '@nimiq/keyguard-client';

export const CashlinkExtraData = {
    FUNDING:  new Uint8Array([0, 130, 128, 146, 135]), // 'CASH'.split('').map(c => c.charCodeAt(0) + 63)
    CLAIMING: new Uint8Array([0, 139, 136, 141, 138]), // 'LINK'.split('').map(c => c.charCodeAt(0) + 63)
};

export default class Cashlink {
    get value() {
        return this._value;
    }

    set value(value: number) {
        if (this._immutable) throw new Error('Cashlink is immutable');
        if (!Nimiq.NumberUtils.isUint64(value) || value === 0) throw new Error('Malformed value');
        this._value = value;
    }

    get message() {
        return this._messageBytes ? Utf8Tools.utf8ByteArrayToString(this._messageBytes) : '';
    }

    set message(message) {
        if (this._immutable) throw new Error('Cashlink is immutable');
        const messageBytes = Utf8Tools.stringToUtf8ByteArray(message);
        if (!Nimiq.NumberUtils.isUint8(messageBytes.length)) throw new Error('Message is too long');
        this._messageBytes = messageBytes;
    }

    get address() {
        return this._wallet.address;
    }

    get recipient() {
        return this._recipient;
    }

    public static create(networkClient: NetworkClient) {
        const privateKey = Nimiq.PrivateKey.generate();
        return new Cashlink(networkClient, privateKey);
    }

    public static parse(str: string) {
        try {
            str = str.replace(/~/g, '').replace(/=*$/, (match) => new Array(match.length).fill('.').join(''));
            const buf = Nimiq.BufferUtils.fromBase64Url(str);
            const key = Nimiq.PrivateKey.unserialize(buf);
            const value = buf.readUint64();
            let message;
            if (buf.readPos === buf.byteLength) {
                message = '';
            } else {
                const messageLength = buf.readUint8();
                const messageBytes = buf.read(messageLength);
                message = Utf8Tools.utf8ByteArrayToString(messageBytes);
            }

            const keyPair = Nimiq.KeyPair.derive(key);
            const wallet = new Nimiq.Wallet(keyPair);

            return { wallet, value, message };
        } catch (e) {
            return undefined;
        }
    }
    private $: NetworkClient;
    private _wallet: Nimiq.Wallet;
    private _accountRequests: Map<Nimiq.Address, Promise<number>>;
    private _wasEmptied?: boolean;
    private _wasEmptiedRequest: Promise<boolean> | null;
    private _currentBalance: number;
    private _immutable: boolean;
    private _eventListeners: {[type: string]: Array<(data: any) => void>};
    private _messageBytes?: Uint8Array;
    private _value!: number;
    private _recipient?: Nimiq.Address;

    constructor(networkClient: NetworkClient, privateKey: Nimiq.PrivateKey, value: number = 0, message?: string) {
        this.$ = networkClient;

        this._wallet = new Nimiq.Wallet(Nimiq.KeyPair.derive(privateKey));
        // for request caching
        this._accountRequests = new Map();
        this._wasEmptiedRequest = null;

        // value will be updated as soon as we have consensus (in _onPotentialBalanceChange)
        // and a confirmed-amount-changed event gets fired
        this._currentBalance = 0;
        if (this.$.consensusState === 'established') {
            this.getAmount().then((balance: number) => this._currentBalance = balance);
        }

        this.value = value;
        if (message) this.message = message;

        this._immutable = !!(value || message);
        this._eventListeners = {};

        // TODO only register event listeners if listening for amount-changed events
        this.$.on(NetworkClient.Events.TRANSACTION_PENDING, this._onTransactionAddedOrMined.bind(this));
        this.$.on(NetworkClient.Events.TRANSACTION_MINED, this._onTransactionAddedOrMined.bind(this));
        this.$.on(NetworkClient.Events.HEAD_CHANGE, this._onHeadChanged.bind(this));
        this.$.on(NetworkClient.Events.CONSENSUS_ESTABLISHED, this._onPotentialBalanceChange.bind(this));

        // Todo enable as soon as addSubscriptions was merged to core
        // this.$.consensus.addSubscribtions(wallet.address);
    }

    public render() {
        const buf = new Nimiq.SerialBuffer(
            /*key*/ this._wallet.keyPair.privateKey.serializedSize +
            /*value*/ 8 +
            /*message length*/ (this._messageBytes ? 1 : 0) +
            /*message*/ (this._messageBytes ? this._messageBytes.length : 0),
        );

        this._wallet.keyPair.privateKey.serialize(buf);
        buf.writeUint64(this._value);
        if (this._messageBytes) {
            buf.writeUint8(this._messageBytes.length);
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

    // public async fund(keyguardClient: KeyguardClient, senderUserFriendlyAddress: string, fee = 0) {
    //     // don't apply _executeUntilSuccess to avoid accidental double funding. Rather throw the exception.
    //     if (!Nimiq.NumberUtils.isUint64(fee)) {
    //         throw new Error('Malformed fee');
    //     }
    //     if (!this._value) {
    //         throw new Error('Unknown value');
    //     }
    //     if (fee >= this._value) {
    //         throw new Error('Fee higher than value');
    //     }

    //     // not using await this._getBlockchainHeight() to stay in the event loop that opens the keyguard popup
    //     const validityStartHeight = this.$.headInfo.height;
    //     const tx = {
    //         appName: 'App', // FIXME
    //         validityStartHeight,
    //         sender: senderUserFriendlyAddress,
    //         recipient: this._wallet.address.toUserFriendlyAddress(),
    //         // The recipient pays the fee, thus send value - fee.
    //         value: Nimiq.Policy.satoshisToCoins(this._value - fee),
    //         fee: Nimiq.Policy.satoshisToCoins(fee),
    //         extraData: CashlinkExtraData.FUNDING,
    //     };
    //     const signedTx = await keyguardClient.signTransaction(tx);
    //     if (!signedTx) throw new Error('Transaction cancelled.');

    //     const senderPubKey = Nimiq.PublicKey.unserialize(new Nimiq.SerialBuffer(signedTx.senderPubKey));
    //     const signature = Nimiq.Signature.unserialize(new Nimiq.SerialBuffer(signedTx.signature));
    //     const proof = Nimiq.SignatureProof.singleSig(senderPubKey, signature).serialize();
    //     const nimiqTx = new Nimiq.ExtendedTransaction(
    //         Nimiq.Address.fromUserFriendlyAddress(senderUserFriendlyAddress),
    //         Nimiq.Account.Type.BASIC, this._wallet.address, Nimiq.Account.Type.BASIC, this._value - fee, fee,
    //         validityStartHeight, Nimiq.Transaction.Flag.NONE, tx.extraData, proof);
    //     await this._sendTransaction(nimiqTx);
    //     this._value = this._value - fee;
    // }

    public async claim(recipientUserFriendlyAddress: string, fee = 0): Promise<void> {
        // get out the funds. Only the confirmed amount, because we can't request unconfirmed funds.
        const balance = await this._getBalance();
        if (balance === 0) {
            throw new Error('There is no confirmed balance in this link');
        }
        this._recipient = Nimiq.Address.fromUserFriendlyAddress(recipientUserFriendlyAddress);
        const transaction = new Nimiq.ExtendedTransaction(this._wallet.address, Nimiq.Account.Type.BASIC,
            this._recipient, Nimiq.Account.Type.BASIC, balance - fee, fee, await this._getBlockchainHeight(),
            Nimiq.Transaction.Flag.NONE, CashlinkExtraData.CLAIMING);
        const keyPair = this._wallet.keyPair;
        const signature = Nimiq.Signature.create(keyPair.privateKey, keyPair.publicKey, transaction.serializeContent());
        const proof = Nimiq.SignatureProof.singleSig(keyPair.publicKey, signature).serialize();
        transaction.proof = proof;
        await this._executeUntilSuccess(async () => {
            await this._sendTransaction(transaction);
        });
    }

    public async getAmount(includeUnconfirmed?: boolean): Promise<number> {
        let balance = await this._getBalance();
        if (includeUnconfirmed) {
            const transferWalletAddress = this._wallet.address;
            for (const transaction of this.$.pendingTransactions) {
                const sender = transaction.sender;
                const recipient = transaction.recipient;
                if (recipient === transferWalletAddress.toUserFriendlyAddress()) {
                    // money sent to the transfer wallet
                    balance += transaction.value!;
                } else if (sender === transferWalletAddress.toUserFriendlyAddress()) {
                    balance -= transaction.value! + transaction.fee!;
                }
            }
        }
        return balance;
    }

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

    public async wasEmptied(): Promise<boolean> {
        if (this._wasEmptied) return true;
        this._wasEmptiedRequest = this._wasEmptiedRequest || this._executeUntilSuccess<boolean>(async () => {
            await this._awaitConsensus();
            const [transactionReceipts, balance] = await Promise.all([
                this.$.requestTransactionReceipts(this._wallet.address.toUserFriendlyAddress()),
                this.getAmount(),
            ]);
            // considered emptied if value is 0 and account has been used
            this._wasEmptied = balance === 0 && transactionReceipts.length > 0;
            return this._wasEmptied;
        });
        return this._wasEmptiedRequest;
    }

    private async _awaitConsensus(): Promise<void> {
        if (this.$.consensusState === 'established') return;
        return new Promise((resolve, reject) => {
            this.$.on(NetworkClient.Events.CONSENSUS_ESTABLISHED, resolve);
            setTimeout(() => reject(new Error('Current network consensus unknown.')), 60 * 1000); // 60 seconds
        });
    }

    private async _sendTransaction(transaction: Nimiq.Transaction): Promise<void> {
        await this._awaitConsensus();
        try {
            const proof = Nimiq.SignatureProof.unserialize(new Nimiq.SerialBuffer(transaction.proof));
            await this.$.relayTransaction({
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
        return this.$.headInfo.height;
    }

    private async _getBalance(address = this._wallet.address): Promise<number> {
        let request = this._accountRequests.get(address);
        if (!request) {
            const headHeight = this.$.headInfo.height;
            request = this._executeUntilSuccess<number>(async () => {
                await this._awaitConsensus();
                const balance = await this.$.getBalance(address.toUserFriendlyAddress());
                if (this.$.headInfo.height !== headHeight && this._accountRequests.has(address)) {
                    // the head changed and there was a new account request for the new head, so we return
                    // that newer request
                    return this._accountRequests.get(address)!;
                } else {
                    // the head didn't change (so everything alright) or we don't have a newer request and
                    // just return the result we got for the older head
                    if (address.equals(this._wallet.address)) {
                        this._currentBalance = balance.get(address.toUserFriendlyAddress()) || 0;
                    }
                    return balance.get(address.toUserFriendlyAddress()) || 0;
                }
            });
            this._accountRequests.set(address, request);
        }
        return request;
    }

    private async _onTransactionAddedOrMined(transaction: DetailedPlainTransaction): Promise<void> {
        if (transaction.recipient === this._wallet.address.toUserFriendlyAddress()
            || transaction.sender === this._wallet.address.toUserFriendlyAddress()) {
            const amount = await this.getAmount(true);
            this.fire('unconfirmed-amount-changed', amount);
        }
    }

    private async _onHeadChanged(o: {height: number}): Promise<void> {
        // balances potentially changed
        this._accountRequests.clear();
        this._wasEmptiedRequest = null;
        // only interested in final balance
        await this._onPotentialBalanceChange();
    }

    private async _onPotentialBalanceChange(): Promise<void> {
        if (this.$.consensusState !== 'established') {
            // only interested in final balance
            return;
        }
        const oldBalance = this._currentBalance;
        const balance = await this.getAmount();

        if (balance !== oldBalance) {
            this.fire('confirmed-amount-changed', balance);
        }
    }
}
