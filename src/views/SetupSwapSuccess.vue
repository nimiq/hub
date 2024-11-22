<script lang="ts">
import { Component } from 'vue-property-decorator';
import { State, Getter } from 'vuex-class';
import { PlainOutput, TransactionDetails as BtcTransactionDetails } from '@nimiq/electrum-client';
import { SmallPage } from '@nimiq/vue-components';
import BitcoinSyncBaseView from './BitcoinSyncBaseView.vue';
import {
    init as initFastspotApi,
    SwapAsset,
    PreSwap,
    Swap,
    confirmSwap,
    getSwap,
    NimHtlcDetails,
    BtcHtlcDetails,
    Contract,
    Erc20HtlcDetails,
} from '@nimiq/fastspot-api';
import { init as initOasisApi, exchangeAuthorizationToken } from '@nimiq/oasis-api';
import StatusScreen from '../components/StatusScreen.vue';
import GlobalClose from '../components/GlobalClose.vue';
import Network from '../components/Network.vue';
import { SetupSwapResult, SignedBtcTransaction, SignedPolygonTransaction } from '../../client/PublicRequestTypes';
import { Static } from '../lib/StaticStore';
import { ParsedSetupSwapRequest } from '../lib/RequestTypes';
import Config from 'config';
import { loadBitcoinJS } from '../lib/bitcoin/BitcoinJSLoader';
import { getElectrumClient } from '../lib/bitcoin/ElectrumClient';
import { decodeBtcScript } from '../lib/bitcoin/BitcoinHtlcUtils';
import { WalletInfo } from '../lib/WalletInfo';

// Import only types to avoid bundling of KeyguardClient in Ledger request if not required.
// (But note that currently, the KeyguardClient is still always bundled in the RpcApi).
type KeyguardSignSwapResult = import('@nimiq/keyguard-client').SignSwapResult;
type KeyguardSignSwapTransactionsRequest = import('@nimiq/keyguard-client').SignSwapTransactionsRequest;
export type SwapHtlcInfo = Pick<KeyguardSignSwapTransactionsRequest, 'fund' | 'redeem'>;

@Component({components: {SmallPage, StatusScreen, GlobalClose}}) // including components used in parent class
export default class SetupSwapSuccess extends BitcoinSyncBaseView {
    protected get State() {
        return {
            ...super.State,
            FETCHING_SWAP_DATA: 'fetching-swap-data',
            FETCHING_SWAP_DATA_FAILED: 'fetching-swap-data-failed',
            SIGNING_TRANSACTIONS: 'signing-transactions',
            FETCHING_BITCOIN_TX: 'fetching-bitcoin-tx',
            BITCOIN_TX_MISMATCH: 'bitcoin-tx-mismatch',
        };
    }

    @Getter protected findWallet!: (id: string) => WalletInfo | undefined;
    @Static protected request!: ParsedSetupSwapRequest;
    protected nimiqNetwork: Network = new Network();
    protected _isDestroyed: boolean = false;
    protected btcMismatchError: string = '';
    @State private keyguardResult?: KeyguardSignSwapResult;

    protected async mounted() {
        Promise.all([
            // no need to preload the Nimiq library, it's available by default
            // if BTC is involved preload BitcoinJS
            this.request.fund.type === SwapAsset.BTC || this.request.redeem.type === SwapAsset.BTC
                ? loadBitcoinJS() : null,
            // if we need to fetch the tx from the network, preload the electrum client
            this.request.redeem.type === SwapAsset.BTC ? getElectrumClient() : null,
        ]).catch(() => void 0);

        // use mounted instead of created to ensure that SetupSwapLedger has the chance to run its created hook before.
        if (!await this._shouldConfirmSwap()) {
            return; // keep potential error message displayed
        }

        // Confirm swap to Fastspot and get contract details
        this.state = this.State.FETCHING_SWAP_DATA;
        initFastspotApi(Config.fastspot.apiEndpoint, Config.fastspot.apiKey);

        let refundAddress = '';
        switch (this.request.fund.type) {
            case SwapAsset.NIM:
                refundAddress = this.request.fund.sender.toUserFriendlyAddress();
                break;
            case SwapAsset.BTC:
                refundAddress = this.request.fund.refundAddress;
                break;
            case SwapAsset.USDC_MATIC:
            case SwapAsset.USDT_MATIC:
                refundAddress = this.request.fund.request.from;
                break;
            default: break;
        }

        let redeemAddress: string | { kty: string, crv: string, x: string } = '';
        switch (this.request.redeem.type) {
            case SwapAsset.NIM:
                redeemAddress = this.request.redeem.recipient.toUserFriendlyAddress();
                break;
            case SwapAsset.BTC:
                redeemAddress = this.request.redeem.output.address;
                break;
            case SwapAsset.USDC_MATIC:
            case SwapAsset.USDT_MATIC:
                redeemAddress = this.request.redeem.request.from;
                break;
            case SwapAsset.EUR:
                // Assemble recipient object
                redeemAddress = {
                    kty: 'OKP',
                    crv: 'Ed25519',
                    x: this._getOasisRecipientPublicKey(),
                };
                break;
            default: break;
        }

        // Generate UID to track account limits
        const walletInfo = this.findWallet(this.request.walletId);
        if (!walletInfo) throw new Error('UNEXPECTED: Cannot find walletId for swap signing');
        let confirmedSwap: Swap;
        try {
            const uid = this.request.kyc ? this.request.kyc.userId : await walletInfo.getUid();
            const s3GrantToken = this.request.kyc ? this.request.kyc.s3GrantToken : undefined;
            let oasisClearingAuthorizationToken: string | undefined;
            if (this.request.kyc && this.request.kyc.oasisGrantToken && this.request.fund.type === SwapAsset.EUR) {
                initOasisApi(Config.oasis.apiEndpoint);
                oasisClearingAuthorizationToken = await exchangeAuthorizationToken(this.request.kyc.oasisGrantToken);
            }

            confirmedSwap = await confirmSwap({
                id: this.request.swapId,
            } as PreSwap, this.request.redeem.type === SwapAsset.EUR ? {
                asset: this.request.redeem.type,
                ...(redeemAddress as { kty: string, crv: string, x: string }),
            } : {
                // Redeem
                asset: this.request.redeem.type,
                address: (redeemAddress as string),
            }, {
                // Refund
                asset: this.request.fund.type,
                address: refundAddress,
            }, uid, s3GrantToken, oasisClearingAuthorizationToken).catch((error) => {
                if (error.message === 'The swap was already confirmed before.') {
                    return getSwap(this.request.swapId) as Promise<Swap>;
                } else if (error.message.includes('503')) {
                    throw new Error(this.$t('503 Service unavailable - please try again later') as string);
                } else {
                    throw error;
                }
            });

            console.debug('Swap:', confirmedSwap);
        } catch (error) {
            console.error(error);
            this.state = this.State.FETCHING_SWAP_DATA_FAILED;
            this.error = error.message || error;
            return;
        }

        if (this._isDestroyed) return;

        // Validate contract details
        // TODO: Validate timeouts if possible (e.g. not possible for NIM)
        let hashRoot: string | undefined;
        let nimiqHtlcHashAlgorithm: 'blake2b' | 'sha256' | 'sha512' | undefined;

        if (confirmedSwap.from.asset === SwapAsset.NIM || confirmedSwap.to.asset === SwapAsset.NIM) {
            const { data: nimHtlcData } = confirmedSwap.contracts[SwapAsset.NIM]!.htlc as NimHtlcDetails;
            const decodedNimHtlc = Nimiq.HashedTimeLockedContract.dataToPlain(Nimiq.BufferUtils.fromHex(nimHtlcData));

            if (!('hashRoot' in decodedNimHtlc && 'hashAlgorithm' in decodedNimHtlc && 'hashCount' in decodedNimHtlc
                && 'sender' in decodedNimHtlc && 'recipient' in decodedNimHtlc)) {
                this.$rpc.reject(new Error('Invalid Nimiq HTLC data'));
                return;
            }
            const {
                sender: decodedRefundAddress,
                recipient: decodedRedeemAddress,
                hashCount,
            } = decodedNimHtlc;
            hashRoot = decodedNimHtlc.hashRoot;
            nimiqHtlcHashAlgorithm = decodedNimHtlc.hashAlgorithm as 'blake2b' | 'sha256' | 'sha512';
            const hashSize = {
                blake2b: 32,
                sha256: 32,
                sha512: 64,
            }[nimiqHtlcHashAlgorithm];

            // @ts-ignore 'argon2d' is no longer defined
            if (nimiqHtlcHashAlgorithm === 'argon2d') {
                // argon2d is blacklisted for HTLCs
                this.$rpc.reject(new Error('Disallowed HTLC hash algorithm argon2d'));
                return;
            }
            if (hashSize !== 32) {
                // Hash must be 32 bytes, as otherwise it cannot work with the BTC HTLC
                this.$rpc.reject(new Error('Disallowed HTLC hash length'));
                return;
            }
            if (hashCount !== 1) {
                // Hash count must be 1 for us to accept the swap
                this.$rpc.reject(new Error('Disallowed HTLC hash count'));
                return;
            }

            if (confirmedSwap.from.asset === SwapAsset.NIM && refundAddress !== decodedRefundAddress) {
                this.$rpc.reject(new Error('Unknown HTLC refund address'));
                return;
            }
            if (confirmedSwap.to.asset === SwapAsset.NIM && redeemAddress !== decodedRedeemAddress) {
                this.$rpc.reject(new Error('Unknown HTLC redeem address'));
                return;
            }
        }

        if (confirmedSwap.from.asset === SwapAsset.BTC || confirmedSwap.to.asset === SwapAsset.BTC) {
            const { script: btcHtlcScript } = confirmedSwap.contracts[SwapAsset.BTC]!.htlc as BtcHtlcDetails;
            await loadBitcoinJS();
            const decodedBtcHtlc = await decodeBtcScript(btcHtlcScript);

            if (hashRoot && decodedBtcHtlc.hashRoot !== hashRoot) {
                this.$rpc.reject(new Error('HTLC hash roots do not match'));
                return;
            }
            hashRoot = decodedBtcHtlc.hashRoot;

            if (confirmedSwap.from.asset === SwapAsset.BTC && refundAddress !== decodedBtcHtlc.refundAddress) {
                this.$rpc.reject(new Error('Unknown HTLC refund address'));
                return;
            }
            if (confirmedSwap.to.asset === SwapAsset.BTC && redeemAddress !== decodedBtcHtlc.redeemAddress) {
                this.$rpc.reject(new Error('Unknown HTLC redeem address'));
                return;
            }
        }

        if (
            confirmedSwap.from.asset === SwapAsset.USDC_MATIC
            || confirmedSwap.to.asset === SwapAsset.USDC_MATIC
            || confirmedSwap.from.asset === SwapAsset.USDT_MATIC
            || confirmedSwap.to.asset === SwapAsset.USDT_MATIC
        ) {
            const contract =
                (confirmedSwap.contracts[SwapAsset.USDC_MATIC] as Contract<SwapAsset.USDC_MATIC> | undefined)
                || (confirmedSwap.contracts[SwapAsset.USDT_MATIC] as Contract<SwapAsset.USDT_MATIC>);
            const htlc = contract.htlc as Erc20HtlcDetails;

            const contractData = {
                id: contract.htlc.address,
                token: '',
                amount: contract.amount,
                refundAddress: contract.refundAddress,
                recipientAddress: contract.redeemAddress,
                hash: confirmedSwap.hash,
                timeout: contract.timeout,
                fee: 0,
                chainTokenFee: 0,
            };

            if (htlc.data) {
                // TODO: Load ethersJS and decode contract data
            }

            if (hashRoot && contractData.hash !== hashRoot) {
                this.$rpc.reject(new Error('HTLC hash roots do not match'));
                return;
            }
            hashRoot = contractData.hash;

            if (
                [SwapAsset.USDC_MATIC, SwapAsset.USDT_MATIC].includes(confirmedSwap.from.asset)
                && refundAddress !== contractData.refundAddress
            ) {
                this.$rpc.reject(new Error('Unknown HTLC refund address'));
                return;
            }
            if (
                [SwapAsset.USDC_MATIC, SwapAsset.USDT_MATIC].includes(confirmedSwap.to.asset)
                && redeemAddress !== contractData.recipientAddress
            ) {
                this.$rpc.reject(new Error('Unknown HTLC redeem address'));
                return;
            }
        }

        if (confirmedSwap.from.asset === SwapAsset.EUR || confirmedSwap.to.asset === SwapAsset.EUR) {
            // TODO: Fetch contract from OASIS API and compare instead of trusting Fastspot

            if (hashRoot && confirmedSwap.hash !== hashRoot) {
                this.$rpc.reject(new Error('HTLC hash roots do not match'));
                return;
            }
            hashRoot = confirmedSwap.hash;

            // TODO: Validate correct recipient public key
        }

        if (!hashRoot) {
            this.$rpc.reject(new Error('UNEXPECTED: Could not extract swap hash from contracts'));
            return;
        }

        // Construct htlc info

        let fundingHtlcInfo: SwapHtlcInfo['fund'] | null = null;
        let redeemingHtlcInfo: SwapHtlcInfo['redeem'] | null = null;

        if (this.request.fund.type === SwapAsset.NIM) {
            const nimHtlcData = confirmedSwap.contracts[SwapAsset.NIM]!.htlc as NimHtlcDetails;

            fundingHtlcInfo = {
                type: SwapAsset.NIM,
                htlcData: Nimiq.BufferUtils.fromHex(nimHtlcData.data),
            };
        }

        if (this.request.fund.type === SwapAsset.BTC) {
            const btcHtlcData = confirmedSwap.contracts[SwapAsset.BTC]!.htlc as BtcHtlcDetails;

            fundingHtlcInfo = {
                type: SwapAsset.BTC,
                htlcScript: Nimiq.BufferUtils.fromHex(btcHtlcData.script),
            };
        }

        if (this.request.fund.type === SwapAsset.USDC_MATIC || this.request.fund.type === SwapAsset.USDT_MATIC) {
            const htlcData = confirmedSwap.contracts[this.request.fund.type]!.htlc as Erc20HtlcDetails;

            if (!htlcData.data) {
                // TODO: Create data with ethersJS
                throw new Error('Missing `data` field in confirmed ERC-20 contract');
            }

            fundingHtlcInfo = {
                type: this.request.fund.type,
                htlcData: htlcData.data,
            };
        }

        if (this.request.fund.type === SwapAsset.EUR) {
            const eurContract = confirmedSwap.contracts[SwapAsset.EUR] as Contract<SwapAsset.EUR>;
            const eurHtlcData = eurContract.htlc;

            fundingHtlcInfo = {
                type: SwapAsset.EUR,
                hash: hashRoot,
                timeout: eurContract.timeout,
                htlcId: eurHtlcData.address,
            };
        }

        if (this.request.redeem.type === SwapAsset.NIM) {
            const nimHtlcData = confirmedSwap.contracts[SwapAsset.NIM]!.htlc as NimHtlcDetails;

            redeemingHtlcInfo = {
                type: SwapAsset.NIM,
                htlcData: Nimiq.BufferUtils.fromHex(nimHtlcData.data),
                htlcAddress: nimHtlcData.address,
            };
        }

        if (this.request.redeem.type === SwapAsset.BTC) {
            const btcHtlcData = confirmedSwap.contracts[SwapAsset.BTC]!.htlc as BtcHtlcDetails;

            // Fetch missing info from the blockchain
            // BTC tx hash and output data

            try {
                this.state = this.State.SYNCING;
                const { transaction, output } = await new Promise<{
                    transaction: BtcTransactionDetails,
                    output: PlainOutput,
                }>(async (resolve, reject) => {
                    try {
                        const listener = (tx: BtcTransactionDetails) => {
                            const htlcOutput = tx.outputs.find((out) => out.address === btcHtlcData.address);
                            if (!htlcOutput) {
                                return false;
                            }
                            if (htlcOutput.value === confirmedSwap.to.amount) {
                                resolve({
                                    transaction: tx,
                                    output: htlcOutput,
                                });
                                electrum.removeListener(handle);
                                return true;
                            }
                            this.state = this.State.BITCOIN_TX_MISMATCH;
                            this.btcMismatchError = this.$t(
                                'Value mismatch (expected {expected} sats, found {found} sats)',
                                {
                                    expected: confirmedSwap.to.amount,
                                    found: htlcOutput.value,
                                },
                            ) as string;
                            return false;
                        };

                        const electrum = await getElectrumClient();
                        await electrum.waitForConsensusEstablished();

                        this.state = this.State.FETCHING_BITCOIN_TX;

                        // First subscribe to new transactions
                        const handle = electrum.addTransactionListener(listener, [btcHtlcData.address]);

                        // Then check history
                        const history = await electrum.getTransactionsByAddress(btcHtlcData.address);
                        for (const tx of history) {
                            if (listener(tx)) return;
                        }
                    } catch (error) {
                        reject(error);
                    }
                });

                redeemingHtlcInfo = {
                    type: SwapAsset.BTC,
                    htlcScript: Nimiq.BufferUtils.fromHex(btcHtlcData.script),
                    transactionHash: transaction.transactionHash,
                    outputIndex: output.index,
                };
            } catch (error) {
                console.error(error);
                this.state = this.State.SYNCING_FAILED;
                this.error = error.message || error;
                return;
            }
        }

        if (this.request.redeem.type === SwapAsset.USDC_MATIC || this.request.redeem.type === SwapAsset.USDT_MATIC) {
            const contract = confirmedSwap.contracts[this.request.redeem.type] as Contract<
                SwapAsset.USDC_MATIC | SwapAsset.USDT_MATIC
            >;
            const htlcData = contract.htlc as Erc20HtlcDetails;

            redeemingHtlcInfo = {
                type: this.request.redeem.type,
                hash: confirmedSwap.hash,
                timeout: contract.timeout,
                htlcId: htlcData.address,
            };
        }

        if (this.request.redeem.type === SwapAsset.EUR) {
            const eurContract = confirmedSwap.contracts[SwapAsset.EUR] as Contract<SwapAsset.EUR>;
            const eurHtlcData = eurContract.htlc;

            redeemingHtlcInfo = {
                type: SwapAsset.EUR,
                hash: hashRoot,
                timeout: eurContract.timeout,
                htlcId: eurHtlcData.address,
            };
        }

        if (this._isDestroyed) return;

        if (!fundingHtlcInfo || !redeemingHtlcInfo) {
            this.$rpc.reject(new Error('Funding or redeeming HTLC info missing.'));
            return;
        }

        // Sign transactions
        this.state = this.State.SIGNING_TRANSACTIONS;
        let nimiqTransaction: Nimiq.Transaction | undefined;
        let nimiqProxyTransaction: Nimiq.Transaction | undefined;
        let bitcoinTransaction: SignedBtcTransaction | undefined;
        let polygonUsdcTransaction: SignedPolygonTransaction | undefined;
        let polygonUsdtTransaction: SignedPolygonTransaction | undefined;
        let refundTransaction: string | undefined;
        let euroSettlement: string | undefined;
        try {
            const signingResult = await this._signSwapTransactions({
                fund: fundingHtlcInfo,
                redeem: redeemingHtlcInfo,
            });
            if (!signingResult) return; // failed to sign and an error is getting displayed
            ({
                nim: nimiqTransaction,
                nimProxy: nimiqProxyTransaction,
                btc: bitcoinTransaction,
                eur: euroSettlement,
                usdc: polygonUsdcTransaction,
                usdt: polygonUsdtTransaction,
                refundTx: refundTransaction,
            } = signingResult);
        } catch (error) {
            if (!this._isDestroyed) {
                this.$rpc.reject(error);
            }
            return;
        }

        if (this._isDestroyed) return;

        if (nimiqTransaction) {
            // for redeeming nim transaction prepare a htlc proof with a dummy preImage and hashRoot
            if (this.request.redeem.type === SwapAsset.NIM && redeemingHtlcInfo.type === SwapAsset.NIM
                && nimiqHtlcHashAlgorithm) {
                const dummyPreImage = '0000000000000000000000000000000000000000000000000000000000000000';
                const dummyHashRoot = '66687aadf862bd776c8fc18b8e9f8e20089714856ee233b3902a591d0d5f2925'; // sha256

                const proof = new Nimiq.SerialBuffer(4 + 2 * 32 + nimiqTransaction.proof.length);
                proof.writeUint8(0 /* Nimiq.HashedTimeLockedContract.ProofType.REGULAR_TRANSFER */);
                proof.writeUint8(1); // hashCount must be 1 for our swaps
                proof.writeUint8({
                    blake2b: 1,
                    sha256: 3,
                    sha512: 4,
                }[nimiqHtlcHashAlgorithm]);
                proof.write(Nimiq.BufferUtils.fromHex(dummyHashRoot));
                proof.writeUint8(32); // PreImage size
                proof.write(Nimiq.BufferUtils.fromHex(dummyPreImage));
                proof.write(new Nimiq.SerialBuffer(nimiqTransaction.proof)); // Current proof is regular SignatureProof
                nimiqTransaction.proof = proof;
                console.log(Nimiq.BufferUtils.toHex(proof));
            }

            // Validate that transaction is valid
            try {
                nimiqTransaction.verify();
            } catch (e) {
                this.$rpc.reject(new Error('NIM transaction is invalid'));
                return;
            }
        }

        // Construct Hub response

        const result: SetupSwapResult = {
            nim: nimiqTransaction ? this.nimiqNetwork.makeSignTransactionResult(nimiqTransaction) : undefined,
            nimProxy: nimiqProxyTransaction
                ? this.nimiqNetwork.makeSignTransactionResult(nimiqProxyTransaction)
                : undefined,
            btc: bitcoinTransaction,
            usdc: polygonUsdcTransaction,
            usdt: polygonUsdtTransaction,
            eur: euroSettlement,
            refundTx: refundTransaction,
        };

        this.$rpc.resolve(result);
    }

    protected destroyed() {
        this._isDestroyed = true;
    }

    protected async _shouldConfirmSwap() {
        // note that this method gets overwritten for SetupSwapLedger
        return this.keyguardResult && this.keyguardResult.success && !this._isDestroyed;
    }

    protected _getOasisRecipientPublicKey() {
        // note that this method gets overwritten for SetupSwapLedger
        if (!this.keyguardResult || !this.keyguardResult.eurPubKey) {
            throw new Error('Cannot find OASIS recipient public key');
        }
        return Nimiq.BufferUtils.toBase64Url(Nimiq.BufferUtils.fromHex(this.keyguardResult.eurPubKey))
            .replace(/\.*$/, ''); // OASIS cannot handle trailing filler dots
    }

    protected async _signSwapTransactions(htlcInfo: SwapHtlcInfo): Promise<{
        nim?: Nimiq.Transaction,
        nimProxy?: Nimiq.Transaction, // only in SetupSwapLedger
        btc?: SignedBtcTransaction,
        usdc?: SignedPolygonTransaction,
        usdt?: SignedPolygonTransaction,
        eur?: string,
        refundTx?: string,
    } | null> {
        // Note that this method gets overwritten for SetupSwapLedger
        const keyguardRequest: KeyguardSignSwapTransactionsRequest = {
            ...htlcInfo,
            swapId: this.request.swapId,
            tmpCookieEncryptionKey: this.keyguardResult!.tmpCookieEncryptionKey,
        };

        const client = this.$rpc.createKeyguardClient();
        const {
            nim: nimiqSignatureResult,
            btc: bitcoinTransaction,
            usdc: polygonUsdcTransaction,
            usdt: polygonUsdtTransaction,
            eur: euroSettlement,
            refundTx,
        } = await client.signSwapTransactions(keyguardRequest);

        // create a nimiq transaction
        let nimiqTransaction: Nimiq.Transaction | undefined;
        if (this.request.fund.type === SwapAsset.NIM && htlcInfo.fund.type === SwapAsset.NIM && nimiqSignatureResult) {
            nimiqTransaction = this.nimiqNetwork.createTx({
                ...this.request.fund,
                recipient: new Nimiq.Address(new Uint8Array(20)),
                recipientType: Nimiq.AccountType.HTLC,
                recipientData: htlcInfo.fund.htlcData,
                flags: 1 /* Nimiq.Transaction.Flag.CONTRACT_CREATION */,
                signerPubKey: nimiqSignatureResult.publicKey,
                signature: nimiqSignatureResult.signature,
            });
        } else if (this.request.redeem.type === SwapAsset.NIM && htlcInfo.redeem.type === SwapAsset.NIM
            && nimiqSignatureResult) {
            nimiqTransaction = this.nimiqNetwork.createTx({
                ...this.request.redeem,
                sender: Nimiq.Address.fromUserFriendlyAddress(htlcInfo.redeem.htlcAddress),
                senderType: Nimiq.AccountType.HTLC,
                signerPubKey: nimiqSignatureResult.publicKey,
                signature: nimiqSignatureResult.signature,
                recipientData: this.request.redeem.extraData,
            });
        }

        return {
            nim: nimiqTransaction,
            btc: bitcoinTransaction ? {
                serializedTx: bitcoinTransaction.raw,
                hash: bitcoinTransaction.transactionHash,
            } : undefined,
            ...(polygonUsdcTransaction ? { usdc: polygonUsdcTransaction } : {}),
            ...(polygonUsdtTransaction ? { usdt: polygonUsdtTransaction } : {}),
            eur: euroSettlement,
            refundTx,
        };
    }

    protected get statusScreenState(): StatusScreen.State {
        if (this.state === this.State.FETCHING_SWAP_DATA_FAILED || this.state === this.State.BITCOIN_TX_MISMATCH) {
            return StatusScreen.State.ERROR;
        }
        return super.statusScreenState;
    }

    protected get statusScreenTitle() {
        switch (this.state) {
            case this.State.FETCHING_SWAP_DATA_FAILED:
                return this.$t('Swap Setup Failed') as string;
            case this.State.SYNCING_FAILED:
                return this.$t('Syncing Failed') as string;
            default:
                return this.$t('Preparing Swap') as string;
        }
    }

    protected get statusScreenStatus() {
        switch (this.state) {
            case this.State.FETCHING_SWAP_DATA:
                return this.$t('Fetching swap data...') as string;
            case this.State.SIGNING_TRANSACTIONS:
                return this.$t('Signing transactions...') as string;
            case this.State.FETCHING_BITCOIN_TX:
                return this.$t('Fetching Bitcoin HTLC...') as string;
            default:
                return super.statusScreenStatus;
        }
    }

    protected get statusScreenMessage() {
        if (this.state === this.State.FETCHING_SWAP_DATA_FAILED) {
            return this.$t('Fetching swap data failed: {error}', { error: this.error }) as string;
        }
        if (this.state === this.State.BITCOIN_TX_MISMATCH) {
            return this.$t('Bitcoin HTLC invalid: {error}', { error: this.btcMismatchError }) as string;
        }
        return super.statusScreenMessage;
    }

    protected get statusScreenAction() {
        if (this.state === this.State.FETCHING_SWAP_DATA_FAILED || this.state === this.State.BITCOIN_TX_MISMATCH) {
            return this.$t('Retry') as string;
        }
        return super.statusScreenAction;
    }

    protected get isGlobalCloseShown() {
        return this.state === this.State.FETCHING_SWAP_DATA_FAILED
            || this.state === this.State.BITCOIN_TX_MISMATCH
            || super.isGlobalCloseShown;
    }
}
</script>
