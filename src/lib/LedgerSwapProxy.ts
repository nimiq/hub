import LedgerApi, { Coin, TransactionInfoNimiq, getBip32Path, parseBip32Path } from '@nimiq/ledger-api';
import { NetworkClient } from '@nimiq/network-client';
import Config from 'config';
import { loadNimiq } from './Helpers';
import { decodeNimHtlcData } from '../lib/HtlcUtils';

const LedgerSwapProxyExtraData = {
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
 */
export default class LedgerSwapProxy {
    public static async create(swapValidityStartHeight: number, ledgerKeyPath: string, ledgerKeyId?: string)
        : Promise<LedgerSwapProxy> {
        const signerKey = await LedgerSwapProxy._createSignerKey(
            swapValidityStartHeight,
            ledgerKeyPath,
            ledgerKeyId,
        );
        return new LedgerSwapProxy(signerKey, swapValidityStartHeight);
    }

    public static async createForRefund(refundSender: Nimiq.Address, ledgerKeyPath: string, ledgerKeyId?: string)
        : Promise<LedgerSwapProxy> {
        // Check if the refund sender is the htlc or the proxy and determine the proxy funding validity start height.

        if (!NetworkClient.hasInstance()) {
            NetworkClient.createInstance(Config.networkEndpoint);
        }
        const networkClient = NetworkClient.Instance;
        await networkClient.init(); // Make sure the client is initialized

        const senderUserFriendlyAddress = refundSender.toUserFriendlyAddress();
        // Get the oldest transaction as funding the transaction. Note that non-legacy swap proxies are swap specific
        // and not reused, therefore the fetched transaction history should be small.
        const senderTransactionHistory = await networkClient.getTransactionsByAddress(senderUserFriendlyAddress);
        if (!senderTransactionHistory.length) throw new Error('Failed to sync sender transaction history');
        const senderFundingTransaction = senderTransactionHistory[senderTransactionHistory.length - 1];

        let proxyAddress: Nimiq.Address;
        if (senderFundingTransaction.data.raw === Nimiq.BufferUtils.toHex(LedgerSwapProxyExtraData.FUND)) {
            // The refund sender got funded by a proxy funding transaction, thus is the proxy.
            proxyAddress = refundSender;
        } else {
            // The refund sender is the HTLC which got funded by the proxy.
            proxyAddress = Nimiq.Address.fromAny(senderFundingTransaction.sender);
        }

        // Retrieve the proxy key for this swap from the Ledger
        let signerKey: Nimiq.KeyPair = await LedgerSwapProxy._createSignerKey(
            senderFundingTransaction.validityStartHeight, // same for proxy and htlc funding tx
            ledgerKeyPath,
            ledgerKeyId,
        );
        if (!signerKey.publicKey.toAddress().equals(proxyAddress)) {
            signerKey = await LedgerSwapProxy._createLegacySignerKey(ledgerKeyPath, ledgerKeyId);
        }
        if (!signerKey.publicKey.toAddress().equals(proxyAddress)) {
            // Unknown refund sender or salt got lost or we're on a different browser with a different salt.
            throw new Error(`Key for proxy ${proxyAddress.toUserFriendlyAddress()} missing.`);
        }

        return new LedgerSwapProxy(signerKey, senderFundingTransaction.validityStartHeight);
    }

    private static async _createSignerKey(
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
            LedgerApi.Nimiq.getPublicKey(entropySourcePublicKeyPath, ledgerKeyId),
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
            LedgerApi.Nimiq.getPublicKey(entropySourcePublicKeyPath, ledgerKeyId),
            loadNimiq(),
        ]);

        return Nimiq.KeyPair.derive(new Nimiq.PrivateKey(entropySourcePublicKey.serialize()));
    }

    private readonly _signerKey: Nimiq.KeyPair;
    private readonly _swapValidityStartHeight: number;

    private constructor(signerKey: Nimiq.KeyPair, swapValidityStartHeight: number) {
        this._signerKey = signerKey;
        this._swapValidityStartHeight = swapValidityStartHeight;
    }

    public get address(): Nimiq.Address {
        return this._signerKey.publicKey.toAddress();
    }

    public getFundingInfo(): Pick<
        TransactionInfoNimiq,
        'recipient' | 'recipientType' | 'validityStartHeight' | 'extraData'
    > {
        return {
            recipient: this.address,
            recipientType: Nimiq.Account.Type.BASIC,
            validityStartHeight: this._swapValidityStartHeight,
            extraData: LedgerSwapProxyExtraData.FUND,
        };
    }

    public getHtlcCreationInfo(htlcData: Uint8Array): Pick<
        TransactionInfoNimiq,
        'sender' | 'senderType' | 'recipient' | 'recipientType' | 'validityStartHeight' | 'flags' | 'extraData'
    > {
        if (!Nimiq.Address.fromAny(decodeNimHtlcData(htlcData).refundAddress).equals(this.address)) {
            throw new Error('The swap proxy must be the created HTLC\'s refund address.');
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
        TransactionInfoNimiq,
        'sender' | 'senderType' | 'extraData'
    > {
        if (refundSender.equals(this.address)) {
            // refunding from proxy
            return {
                sender: refundSender,
                senderType: Nimiq.Account.Type.BASIC,
                extraData: LedgerSwapProxyExtraData.REDEEM,
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
    }: TransactionInfoNimiq): Promise<Nimiq.Transaction> {
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

        transaction.proof = Nimiq.SignatureProof.singleSig(
            this._signerKey.publicKey,
            Nimiq.Signature.create(
                this._signerKey.privateKey,
                this._signerKey.publicKey,
                transaction.serializeContent(),
            ),
        ).serialize();

        return transaction;
    }
}
