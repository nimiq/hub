import LedgerApi, { Coin, TransactionInfoNimiq, getBip32Path, parseBip32Path } from '@nimiq/ledger-api';
import { NetworkClient } from '@nimiq/network-client';
import Config from 'config';
import { loadNimiq } from './Helpers';

export const LedgerSwapProxyMarker = {
    // HTLC Proxy Funding, abbreviated as 'HPFD', mapped to values outside of basic ascii range
    FUND:  new Uint8Array([0, ...('HPFD'.split('').map((c) => c.charCodeAt(0) + 63))]),
    // HTLC Proxy Redeeming, abbreviated as 'HPRD', mapped to values outside of basic ascii range
    REDEEM: new Uint8Array([0, ...('HPRD'.split('').map((c) => c.charCodeAt(0) + 63))]),
};

const LEDGER_SWAP_PROXY_SALT_STORAGE_KEY = 'ledger-swap-proxy-salt';

/**
 * As the Nimiq Ledger app is not able to sign HTLC transactions yet, we currently use a temporary in-memory key for
 * creating, redeeming and refunding HTLCs. The proxy is designed as follows:
 * - It uses data derived from the ledger key to make access to the Ledger key mandatory for accessing the funds.
 * - To create a unique proxy for each swap, the validity start height of the Nimiq swap transaction is factored in.
 * - As only public data can be fetched from the Ledger, we salt the data with a locally stored random secret.
 * - To avoid loss of funds if the random secret gets lost, the proxy is a multi-signature address with the Ledger
 *   as a backup signer, such that the proxy can be redeemed via the Ledger directly and once the Ledger app
 *   supports HTLC transactions, the HTLC too.
 */
export default class LedgerSwapProxy {
    public static async create(swapValidityStartHeight: number, ledgerKeyPath: string, ledgerKeyId?: string)
        : Promise<LedgerSwapProxy> {
        const localSignerKey = await LedgerSwapProxy._createLocalMultiSigSignerKey(
            swapValidityStartHeight,
            ledgerKeyPath,
            ledgerKeyId,
        );
        const ledgerSignerPublicKey = await LedgerApi.Nimiq.getPublicKey(
            ledgerKeyPath,
            ledgerKeyId,
            Config.ledgerApiNimiqVersion,
        );
        const proxyAddress = LedgerSwapProxy._computeMultiSigAddress(localSignerKey.publicKey, ledgerSignerPublicKey);
        return new LedgerSwapProxy(proxyAddress, swapValidityStartHeight, localSignerKey,
            ledgerSignerPublicKey, ledgerKeyPath, ledgerKeyId);
    }

    public static async createForRefund(refundSender: Nimiq.Address, ledgerKeyPath: string, ledgerKeyId?: string)
        : Promise<LedgerSwapProxy> {
        // Check if the refund sender is the htlc or the proxy and determine the swap validity start height.
        const senderFundingTransaction = await LedgerSwapProxy._fetchFundingTransaction(refundSender);
        const validityStartHeight = senderFundingTransaction.validityStartHeight; // same for proxy and htlc funding tx

        let proxyAddress: Nimiq.Address;
        let originalLocalSignerPublicKey: Nimiq.PublicKey | null = null;
        if (senderFundingTransaction.data.raw.startsWith(Nimiq.BufferUtils.toHex(LedgerSwapProxyMarker.FUND))) {
            // The refund sender got funded by a proxy funding transaction, thus is the proxy.
            proxyAddress = refundSender;
            originalLocalSignerPublicKey = LedgerSwapProxy._getOriginalLocalSignerPublicKey(
                senderFundingTransaction.data.raw);
        } else {
            // The refund sender is the HTLC which got funded by the proxy.
            proxyAddress = Nimiq.Address.fromAny(senderFundingTransaction.sender);
        }

        // Find the correct signer key.

        // First check the multisig signer key derived from the Ledger and local salt.
        const localSignerKey = await LedgerSwapProxy._createLocalMultiSigSignerKey(
            validityStartHeight,
            ledgerKeyPath,
            ledgerKeyId,
        );
        const ledgerSignerPublicKey = await LedgerApi.Nimiq.getPublicKey(
            ledgerKeyPath,
            ledgerKeyId,
            Config.ledgerApiNimiqVersion,
        );
        if (LedgerSwapProxy._computeMultiSigAddress(localSignerKey.publicKey, ledgerSignerPublicKey)
            .equals(proxyAddress)) {
            return new LedgerSwapProxy(proxyAddress, validityStartHeight, localSignerKey,
                ledgerSignerPublicKey, ledgerKeyPath, ledgerKeyId);
        }

        // Do we have the wrong local signer key due to a different salt because it got lost or we're on a different
        // browser? Try to get the original local signer public key from the transaction history instead.
        if (!originalLocalSignerPublicKey
            && !senderFundingTransaction.data.raw.startsWith(Nimiq.BufferUtils.toHex(LedgerSwapProxyMarker.FUND))) {
            // We don't have the originalLocalSignerPublicKey yet and didn't already check for it above because the
            // senderFundingTransaction funds the HTLC and not the proxy. Fetch the proxy funding transaction and try to
            // extract the originalLocalSignerPublicKey from it.
            const proxyFundingTransaction = await LedgerSwapProxy._fetchFundingTransaction(proxyAddress);
            originalLocalSignerPublicKey = LedgerSwapProxy._getOriginalLocalSignerPublicKey(
                proxyFundingTransaction.data.raw);
        }
        if (originalLocalSignerPublicKey
            && LedgerSwapProxy._computeMultiSigAddress(originalLocalSignerPublicKey, ledgerSignerPublicKey)
                .equals(proxyAddress)) {
            // Note that this LedgerSwapProxy is not able to sign transactions locally, as the correct localSignerKey
            // is unknown. Transactions have to be signed with the Ledger as secondary signer instead.
            return new LedgerSwapProxy(proxyAddress, validityStartHeight, originalLocalSignerPublicKey,
                ledgerSignerPublicKey, ledgerKeyPath, ledgerKeyId);
        }

        // Try the legacy proxy key.
        const legacySignerKey = await LedgerSwapProxy._createLegacySignerKey(ledgerKeyPath, ledgerKeyId);
        if (legacySignerKey.publicKey.toAddress().equals(proxyAddress)) {
            return new LedgerSwapProxy(proxyAddress, validityStartHeight, legacySignerKey,
                /* ledgerSignerPublicKey */ null, ledgerKeyPath, ledgerKeyId);
        }

        // Unknown refund sender.
        throw new Error(`Proxy signer key missing for refund sender ${refundSender.toUserFriendlyAddress()}.`);
    }

    private static async _createLocalMultiSigSignerKey(
        swapValidityStartHeight: number,
        ledgerKeyPath: string,
        ledgerKeyId?: string,
    ): Promise<Nimiq.KeyPair> {
        const { addressIndex: ledgerAddressIndex } = parseBip32Path(ledgerKeyPath);
        const entropySourcePublicKeyPath = getBip32Path({
            coin: Coin.NIMIQ,
            // Create a unique proxy per swap by factoring in the validity start height of the Nimiq swap transaction
            // and the address index of the proxy owning Ledger address. Go from the maximum index allowed by bip32.
            accountIndex: 2 ** 31 - 1 - swapValidityStartHeight,
            addressIndex: 2 ** 31 - 1 - ledgerAddressIndex,
        });
        const [entropySourcePublicKey] = await Promise.all([
            LedgerApi.Nimiq.getPublicKey(entropySourcePublicKeyPath, ledgerKeyId, Config.ledgerApiNimiqVersion),
            loadNimiq(),
        ]);

        if (!localStorage[LEDGER_SWAP_PROXY_SALT_STORAGE_KEY]) {
            // generate a 32 byte random salt
            localStorage[LEDGER_SWAP_PROXY_SALT_STORAGE_KEY] = Nimiq.BufferUtils.toBase64(
                Nimiq.PrivateKey.generate().serialize());
        }
        let salt: Uint8Array;
        try {
            salt = Nimiq.BufferUtils.fromBase64(
                localStorage[LEDGER_SWAP_PROXY_SALT_STORAGE_KEY],
                Nimiq.PrivateKey.SIZE,
            );
        } catch (e) {
            throw new Error(`Failed to read random salt from local storage: ${e.message || e}`);
        }

        const saltedEntropySource = new Uint8Array(entropySourcePublicKey.serializedSize + salt.length);
        saltedEntropySource.set(entropySourcePublicKey.serialize(), 0);
        saltedEntropySource.set(salt, entropySourcePublicKey.serializedSize);
        const proxyEntropy = Nimiq.Hash.computeBlake2b(saltedEntropySource);
        return Nimiq.KeyPair.derive(new Nimiq.PrivateKey(proxyEntropy));
    }

    private static async _createLegacySignerKey(ledgerKeyPath: string, ledgerKeyId?: string): Promise<Nimiq.KeyPair> {
        const { addressIndex: ledgerAddressIndex } = parseBip32Path(ledgerKeyPath);
        const entropySourcePublicKeyPath = getBip32Path({
            coin: Coin.NIMIQ,
            accountIndex: 2 ** 31 - 1, // max index allowed by bip32
            addressIndex: 2 ** 31 - 1 - ledgerAddressIndex, // use a distinct proxy per address for improved privacy
        });
        const [entropySourcePublicKey] = await Promise.all([
            LedgerApi.Nimiq.getPublicKey(entropySourcePublicKeyPath, ledgerKeyId, Config.ledgerApiNimiqVersion),
            loadNimiq(),
        ]);

        return Nimiq.KeyPair.derive(new Nimiq.PrivateKey(entropySourcePublicKey.serialize()));
    }

    private static _computeMultiSigAddress(
        localSignerPublicKey: Nimiq.PublicKey,
        ledgerSignerPublicKey: Nimiq.PublicKey,
    ): Nimiq.Address {
        // See MultiSigWallet in core-js. Note that we don't have to aggregate the public keys as it's a 1 of 2 multi
        // sig, where a single signature suffices.
        const publicKeys = [localSignerPublicKey, ledgerSignerPublicKey].sort((a, b) => a.compare(b));
        const merkleRoot = Nimiq.MerkleTree.computeRoot(publicKeys);
        return Nimiq.Address.fromHash(merkleRoot);
    }

    private static async _fetchFundingTransaction(htlcOrProxyAddress: Nimiq.Address)
        : Promise<ReturnType<Nimiq.Client.TransactionDetails['toPlain']>> {
        if (!NetworkClient.hasInstance()) {
            NetworkClient.createInstance(Config.networkEndpoint);
        }
        const networkClient = NetworkClient.Instance;
        await networkClient.init(); // Make sure the client is initialized

        // Get the oldest transaction as funding transaction. Note that non-legacy swap proxies are swap specific and
        // not reused, therefore the fetched transaction history should be small unless it's a legacy swap proxy.
        const userFriendlyAddress = htlcOrProxyAddress.toUserFriendlyAddress();
        const transactionHistory = await networkClient.getTransactionsByAddress(userFriendlyAddress);
        if (!transactionHistory.length) throw new Error(`Failed to get transaction history for ${userFriendlyAddress}`);
        return transactionHistory[transactionHistory.length - 1];
    }

    private static _getOriginalLocalSignerPublicKey(proxyFundingDataHex: string): Nimiq.PublicKey | null {
        const expectedDataHexLength = (LedgerSwapProxyMarker.FUND.length + Nimiq.PublicKey.SIZE) * 2; //  * 2 for hex
        if (proxyFundingDataHex.length !== expectedDataHexLength
            || !proxyFundingDataHex.startsWith(Nimiq.BufferUtils.toHex(LedgerSwapProxyMarker.FUND))) return null;
        return new Nimiq.PublicKey(Nimiq.BufferUtils.fromHex(
            proxyFundingDataHex.substring(LedgerSwapProxyMarker.FUND.length * 2)));
    }

    private readonly _localSignerPublicKey: Nimiq.PublicKey;
    private readonly _localSignerPrivateKey: Nimiq.PrivateKey | null;

    private constructor(
        public readonly address: Nimiq.Address,
        private readonly _swapValidityStartHeight: number,
        _localSignerKey: Nimiq.KeyPair | Nimiq.PublicKey,
        private _ledgerSignerPublicKey: Nimiq.PublicKey | null,
        private readonly _ledgerKeyPath: string,
        private readonly _ledgerKeyId?: string,
    ) {
        if (_localSignerKey instanceof Nimiq.KeyPair) {
            this._localSignerPublicKey = _localSignerKey.publicKey;
            this._localSignerPrivateKey = _localSignerKey.privateKey;
        } else {
            this._localSignerPublicKey = _localSignerKey;
            this._localSignerPrivateKey = null;
        }
    }

    public get canSignLocally(): boolean {
        return !!this._localSignerPrivateKey;
    }

    public getFundingInfo(): Pick<
        TransactionInfoNimiq<typeof Config.ledgerApiNimiqVersion>,
        'recipient' | 'recipientType' | 'validityStartHeight' | 'extraData'
    > {
        return {
            recipient: this.address,
            recipientType: Nimiq.Account.Type.BASIC,
            validityStartHeight: this._swapValidityStartHeight,
            extraData: this._ledgerSignerPublicKey
                ? new Uint8Array([...LedgerSwapProxyMarker.FUND, ...this._localSignerPublicKey.serialize()])
                : LedgerSwapProxyMarker.FUND, // legacy proxy
        };
    }

    public getHtlcCreationInfo(htlcData: Uint8Array): Pick<
        TransactionInfoNimiq<typeof Config.ledgerApiNimiqVersion>,
        'sender' | 'senderType' | 'recipient' | 'recipientType' | 'validityStartHeight' | 'flags' | 'extraData'
    > {
        const decodedHtlcScript = Nimiq.HashedTimeLockedContract.dataToPlain(htlcData);
        if (!('sender' in decodedHtlcScript) || !Nimiq.Address.fromAny(decodedHtlcScript.sender).equals(this.address)) {
            throw new Error('The HTLC refund address must be the swap proxy.');
        }
        return {
            sender: this.address,
            senderType: Nimiq.Account.Type.BASIC,
            recipient: Nimiq.Address.CONTRACT_CREATION,
            recipientType: Nimiq.Account.Type.HTLC,
            validityStartHeight: this._swapValidityStartHeight,
            flags: Nimiq.Transaction.Flag.CONTRACT_CREATION,
            extraData: htlcData,
        };
    }

    public getRefundInfo(refundSender: Nimiq.Address): Pick<
        TransactionInfoNimiq<typeof Config.ledgerApiNimiqVersion>,
        'sender' | 'senderType' | 'extraData'
    > {
        if (refundSender.equals(this.address)) {
            // refunding from proxy
            return {
                sender: refundSender,
                senderType: Nimiq.Account.Type.BASIC,
                extraData: LedgerSwapProxyMarker.REDEEM,
            };
        } else {
            // refunding from htlc
            return {
                sender: refundSender,
                senderType: Nimiq.Account.Type.HTLC,
            };
        }
    }

    public async signTransaction({
        sender,
        senderType = Nimiq.Account.Type.BASIC,
        recipient,
        recipientType = Nimiq.Account.Type.BASIC,
        value,
        fee = 0,
        validityStartHeight,
        flags = Nimiq.Transaction.Flag.NONE,
        extraData,
        network,
    }: TransactionInfoNimiq<typeof Config.ledgerApiNimiqVersion>): Promise<Nimiq.Transaction> {
        await loadNimiq();

        // Always create an ExtendedTransaction because all transactions that will typically be signed by the proxy will
        // be ExtendedTransactions because they include extraData or have sender- or recipientType HTLC.
        const transaction = new Nimiq.ExtendedTransaction(
            sender,
            senderType,
            recipient,
            recipientType,
            value,
            fee,
            validityStartHeight,
            flags,
            extraData || new Uint8Array(0),
            undefined,
            network ? Nimiq.GenesisConfig.CONFIGS[network].NETWORK_ID : undefined,
        );

        if (this._localSignerPrivateKey) {
            const signature = Nimiq.Signature.create(
                this._localSignerPrivateKey,
                this._localSignerPublicKey,
                transaction.serializeContent(),
            );
            transaction.proof = this.createSignatureProof(this._localSignerPublicKey, signature).serialize();
        } else {
            // Sign with the Ledger as backup.
            this._ledgerSignerPublicKey = this._ledgerSignerPublicKey
                // should never actually happen
                || await LedgerApi.Nimiq.getPublicKey(
                    this._ledgerKeyPath,
                    this._ledgerKeyId,
                    Config.ledgerApiNimiqVersion,
                );
            if (transaction.senderType !== Nimiq.Account.Type.BASIC
                || transaction.recipientType !== Nimiq.Account.Type.BASIC) {
                throw new Error('Contract transactions can currently not be signed by the Ledger.');
            }
            const { signature } = Nimiq.SignatureProof.unserialize(new Nimiq.SerialBuffer(
                (await LedgerApi.Nimiq.signTransaction(
                    transaction,
                    this._ledgerKeyPath,
                    this._ledgerKeyId,
                    Config.ledgerApiNimiqVersion,
                )).proof,
            ));
            transaction.proof = this.createSignatureProof(this._ledgerSignerPublicKey!, signature).serialize();
        }

        return transaction;
    }

    public createSignatureProof(signer: Nimiq.PublicKey, signature: Nimiq.Signature): Nimiq.SignatureProof {
        if (!signer.equals(this._localSignerPublicKey) && !signer.equals(this._ledgerSignerPublicKey)) {
            throw new Error('Invalid proxy signer.');
        }
        if (!this._ledgerSignerPublicKey) {
            return Nimiq.SignatureProof.singleSig(signer, signature);
        } else {
            // Create a multisig SignatureProof.
            const publicKeys = [this._localSignerPublicKey, this._ledgerSignerPublicKey!].sort((a, b) => a.compare(b));
            return Nimiq.SignatureProof.multiSig(signer, publicKeys, signature);
        }
    }
}
