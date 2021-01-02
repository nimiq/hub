<template>
    <div class="container">
        <SmallPage>
            <PageHeader back-arrow @back="_close">
                <template #default>{{ $t('Confirm Swap') }}</template>
                <template #more>
                    <!-- Exchange rate info -->
                    <Tooltip preferredPosition="bottom right" class="exchange-rate-tooltip">
                        <template #trigger>{{ _formattedExchangeRate }}</template>
                        <template #default>{{ $t('This rate includes the swap fee.') }}</template>
                    </Tooltip>
                    <!-- Fee info -->
                    <Tooltip preferredPosition="bottom left" class="fee-tooltip">
                        <template #trigger>
                            <i18n path="{totalFees} fees" :tag="false">
                                <template #totalFees>
                                    <FiatAmount
                                        :amount="_totalFiatFees"
                                        :currency="request.fiatCurrency"
                                    />
                                </template>
                            </i18n>
                        </template>
                        <template #default>
                            <!-- Bitcoin fee info first -->
                            <label>{{ $t('BTC network fee') }}</label>
                            <FiatAmount
                                :amount="_toFiat(_amountInfoForCurrency[SwapAsset.BTC].fees, SwapAsset.BTC)"
                                :currency="request.fiatCurrency"
                            />
                            <div class="explainer">{{ $t('Atomic swaps require two BTC transactions.') }}</div>

                            <!-- Nimiq fee info -->
                            <label>{{ $t('NIM network fee') }}</label>
                            <FiatAmount
                                :amount="_toFiat(_amountInfoForCurrency[SwapAsset.NIM].fees, SwapAsset.NIM)"
                                :currency="request.fiatCurrency"
                            />

                            <!-- Swap fee -->
                            <label>{{ $t('Swap fee') }}</label>
                            <FiatAmount
                                :amount="_toFiat(request.serviceSwapFee, _fundingAmountInfo.currency)"
                                :currency="request.fiatCurrency"
                            />
                            <div class="explainer">{{ $t('{percentage} of swap value.', {
                                percentage: _formattedServiceFee,
                            }) }}</div>

                            <hr>

                            <!-- Total fees -->
                            <label class="total">{{ $t('Total fees') }}</label>
                            <FiatAmount
                                :amount="_totalFiatFees"
                                :currency="request.fiatCurrency"
                                class="total"
                            />
                        </template>
                    </Tooltip>
                </template>
            </PageHeader>

            <PageBody>
                <div class="address-infos">
                    <Identicon :address="nimiqLedgerAddressInfo.address.toUserFriendlyAddress()" />
                    <label>{{ nimiqLedgerAddressInfo.label }}</label>

                    <label>{{ $t('Bitcoin') }}</label>
                    <img src="/icon-btc.svg">
                </div>

                <div class="balance-bar">
                    <template v-for="({currency, background, oldFiatBalance, newFiatBalance}, i) in _balanceBarEntries">
                        <template v-if="_balanceBarEntries[i - 1] && _balanceBarEntries[i - 1].currency !== currency">
                            <div class="separator"></div>
                        </template>
                        <div class="bar" :style="{
                            flexGrow: newFiatBalance,
                            opacity: newFiatBalance !== oldFiatBalance ? 1 : .25,
                            background: background,
                            borderColor: background,
                        }">
                            <div v-if="newFiatBalance > oldFiatBalance" class="change" :style="{
                                width: `${(newFiatBalance - oldFiatBalance) / newFiatBalance * 100}%`,
                            }"></div>
                        </div>
                    </template>
                </div>

                <div class="swap-values">
                    <div :class="{ redeeming: _redeemingAmountInfo === _baseAmountInfo }">
                        <Amount
                            :amount="_baseAmountInfo.myAmount"
                            :currency="_baseAmountInfo.currency"
                            :currencyDecimals="_baseAmountInfo.currencyDecimals"
                            :maxDecimals="_baseAmountInfo.currencyDecimals"
                            :minDecimals="0"
                        />
                        <FiatAmount
                            :amount="_toFiat(_baseAmountInfo.myAmount, _baseAmountInfo.currency)"
                            :currency="request.fiatCurrency"
                        />
                    </div>
                    <div :class="{ redeeming: _redeemingAmountInfo === _otherAmountInfo }">
                        <Amount
                            :amount="_otherAmountInfo.myAmount"
                            :currency="_otherAmountInfo.currency"
                            :currencyDecimals="_otherAmountInfo.currencyDecimals"
                            :maxDecimals="_otherAmountInfo.currencyDecimals"
                            :minDecimals="0"
                        />
                        <FiatAmount
                            :amount="_toFiat(_otherAmountInfo.myAmount, _otherAmountInfo.currency)"
                            :currency="request.fiatCurrency"
                        />
                    </div>
                </div>

                <div class="new-balances">
                    <div>
                        <Amount
                            :amount="_baseAmountInfo.newBalance"
                            :currency="_baseAmountInfo.currency"
                            :currencyDecimals="_baseAmountInfo.currencyDecimals"
                            :maxDecimals="_baseAmountInfo.currencyDecimals"
                            :minDecimals="0"
                        />
                        <FiatAmount
                            :amount="_toFiat(_baseAmountInfo.newBalance, _baseAmountInfo.currency)"
                            :currency="request.fiatCurrency"
                        />
                    </div>
                    <div>
                        <Amount
                            :amount="_otherAmountInfo.newBalance"
                            :currency="_otherAmountInfo.currency"
                            :currencyDecimals="_otherAmountInfo.currencyDecimals"
                            :maxDecimals="_otherAmountInfo.currencyDecimals"
                            :minDecimals="0"
                        />
                        <FiatAmount
                            :amount="_toFiat(_otherAmountInfo.newBalance, _otherAmountInfo.currency)"
                            :currency="request.fiatCurrency"
                        />
                    </div>
                </div>
            </PageBody>

            <div class="bottom-container" :class="{
                'full-height': state === State.SYNCING_FAILED || state === State.FETCHING_SWAP_DATA_FAILED,
            }">
                <LedgerUi small
                    @information-shown="ledgerInstructionsShown = true"
                    @no-information-shown="ledgerInstructionsShown = false"
                />
                <transition name="transition-fade">
                    <StatusScreen v-if="state === State.SYNCING_FAILED || state === State.FETCHING_SWAP_DATA_FAILED
                        || !ledgerInstructionsShown"
                        :state="statusScreenState"
                        :title="statusScreenTitle"
                        :status="statusScreenStatus"
                        :message="statusScreenMessage"
                        :mainAction="statusScreenAction"
                        @main-action="_statusScreenActionHandler"
                        :small="state !== State.SYNCING_FAILED && state !== State.FETCHING_SWAP_DATA_FAILED"
                    />
                </transition>
            </div>
        </SmallPage>

        <GlobalClose :hidden="state === State.FINISHED" />
    </div>
</template>

<script lang="ts">
import { Component, Mixins } from 'vue-property-decorator';
import { Getter } from 'vuex-class';
import { SmallPage, PageHeader, PageBody, Identicon, Amount, FiatAmount, Tooltip } from '@nimiq/vue-components';
import SetupSwap, { SwapSetupInfo } from './SetupSwap.vue';
import SetupSwapSuccess, { SwapHtlcInfo } from './SetupSwapSuccess.vue';
import StatusScreen from '../components/StatusScreen.vue';
import GlobalClose from '../components/GlobalClose.vue';
import LedgerUi from '../components/LedgerUi.vue';
import Network from '../components/Network.vue';
import LedgerApi, {
    RequestTypeNimiq as LedgerApiRequestTypeNimiq,
    RequestTypeBitcoin as LedgerApiRequestTypeBitcoin,
    TransactionInfoNimiq as LedgerNimiqTransactionInfo,
    TransactionInfoBitcoin as LedgerBitcoinTransactionInfo,
    getBip32Path,
    Coin,
} from '@nimiq/ledger-api';
import { FormattableNumber } from '@nimiq/utils';
import {
    getBackgroundColorName as getIdenticonBackgroundColorName,
    backgroundColors as identiconBackgroundColors,
    colorNames as identiconColorNames,
// @ts-ignore Could not find a declaration file for module '@nimiq/iqons'.
} from '@nimiq/iqons';
import { SwapAsset } from '@nimiq/fastspot-api';
import Config from 'config';
import { SignedBtcTransaction } from '../lib/PublicRequestTypes';
import { WalletInfo } from '../lib/WalletInfo';
import { ERROR_CANCELED } from '../lib/Constants';
import { BTC_NETWORK_TEST } from '../lib/bitcoin/BitcoinConstants';
import { loadBitcoinJS } from '../lib/bitcoin/BitcoinJSLoader';
import { getElectrumClient } from '../lib/bitcoin/ElectrumClient';
import { satoshisToCoins } from '../lib/bitcoin/BitcoinUtils';
import { prepareBitcoinTransactionForLedgerSigning } from '../lib/bitcoin/BitcoinLedgerUtils';

type BalanceBarEntry = {
    currency: SwapAsset,
    background: string,
    oldFiatBalance: number,
    newFiatBalance: number,
};

type SwapAmountInfo = {
    myAmount: number,
    theirAmount: number,
    fees: number,
    currency: SwapAsset,
    currencyDecimals: number,
    fiatRate: number;
    newBalance?: number,
};

// As the Ledger Nimiq app currently does not support signing HTLCs yet, we use a key derived from the Ledger Nimiq
// public key at LEDGER_HTLC_PROXY_KEY_PATH as a proxy for signing the HTLC. Note that 2 ** 31 - 1 is the max index
// allowed by bip32.
const LEDGER_HTLC_PROXY_KEY_PATH = getBip32Path({
    coin: Coin.NIMIQ,
    accountIndex: 2 ** 31 - 1,
    addressIndex: 2 ** 31 - 1,
});

const ProxyExtraData = {
    // HTLC Proxy Funding, abbreviated as 'HPFD', mapped to values outside of basic ascii range
    FUND:  new Uint8Array([0, ...('HPFD'.split('').map((c) => c.charCodeAt(0) + 63))]),
    // HTLC Proxy Redeeming, abbreviated as 'HPRD', mapped to values outside of basic ascii range
    REDEEM: new Uint8Array([0, ...('HPRD'.split('').map((c) => c.charCodeAt(0) + 63))]),
};

@Component({components: {
    SmallPage,
    PageHeader,
    PageBody,
    Identicon,
    Amount,
    FiatAmount,
    Tooltip,
    StatusScreen,
    GlobalClose,
    LedgerUi,
}})
export default class SetupSwapLedger extends Mixins(SetupSwap, SetupSwapSuccess) {
    protected get State() {
        return {
            // super.State doesn't work
            ...(this.constructor as any).superOptions.computed.State.get.call(this),
            FINISHED: 'finished',
        };
    }

    @Getter protected findWallet!: (id: string) => WalletInfo | undefined;
    protected _account!: WalletInfo;
    private readonly SwapAsset = SwapAsset;
    private ledgerInstructionsShown = false;
    private nimiqLedgerAddressInfo!: { address: Nimiq.Address, label: string, balance: number };
    private _nimiqProxyKeyPromise!: Promise<Nimiq.KeyPair>;
    private _setupSwapPromise!: Promise<SwapSetupInfo>;

    protected async created() {
        // preload BitcoinJS and the electrum client used in prepareBitcoinTransactionForLedgerSigning
        Promise.all([
            loadBitcoinJS(),
            getElectrumClient(),
        ]).catch(() => void 0);

        this._setupSwapPromise = new Promise((resolve) => this._setupSwap = resolve);

        if ((this.request.fund.type !== SwapAsset.NIM && this.request.fund.type !== SwapAsset.BTC)
            || (this.request.redeem.type !== SwapAsset.NIM && this.request.redeem.type !== SwapAsset.BTC)) {
            const error = new Error('Fiat swaps currently not supported for Ledgers');
            this.$rpc.reject(error);
            throw error;
        }

        // existence checked by _hubApiHandler in RpcApi
        this._account = this.findWallet(this.request.walletId)!;

        const nimiqLedgerAddress = this.request.fund.type === SwapAsset.NIM
            ? this.request.fund.sender
            : this.request.redeem.type === SwapAsset.NIM
                ? this.request.redeem.recipient
                : (() => { throw new Error('Swap does not contain a NIM address'); })();
        const nimiqLedgerAddressInfo = this._account.findContractByAddress(nimiqLedgerAddress)
            || this._account.accounts.get(nimiqLedgerAddress.toUserFriendlyAddress());
        if (!nimiqLedgerAddressInfo) {
            this.$rpc.reject(new Error(`Unknown address ${nimiqLedgerAddress.toUserFriendlyAddress()}`));
            return;
        }
        if (this.request.nimiqAddresses) {
            // Use the provided balance as it's potentially more up to date. Existence of an entry for our address is
            // ensured by RequestParser.
            nimiqLedgerAddressInfo.balance = this.request.nimiqAddresses.find(
                ({ address }) => Nimiq.Address.fromAny(address).equals(nimiqLedgerAddress))!.balance;
        } else {
            nimiqLedgerAddressInfo.balance = nimiqLedgerAddressInfo.balance || 0;
        }
        this.nimiqLedgerAddressInfo = nimiqLedgerAddressInfo as Required<Pick<
            typeof nimiqLedgerAddressInfo,
            'address' | 'label' | 'balance'
        >>;

        // As the Ledger Nimiq app currently does not support signing HTLCs yet, we use a proxy in-memory key.
        // This key gets derived from the Ledger public key at LEDGER_HTLC_PROXY_KEY_PATH as entropy.
        this._nimiqProxyKeyPromise = (async () => {
            const pubKeyAsEntropy = await LedgerApi.Nimiq.getPublicKey(LEDGER_HTLC_PROXY_KEY_PATH, this._account.keyId);
            const nimProxyKey = Nimiq.KeyPair.derive(new Nimiq.PrivateKey(pubKeyAsEntropy.serialize()));

            // Replace nim address by the proxy's address. Don't replace request.nimiqAddresses which should contain the
            // original address for display.
            const proxyAddress = nimProxyKey.publicKey.toAddress();
            if (this.request.fund.type === SwapAsset.NIM) {
                this.request.fund.sender = proxyAddress; // also defines the htlc refundAddress in SetupSwapSuccess
            } else if (this.request.redeem.type === SwapAsset.NIM) {
                this.request.redeem.recipient = proxyAddress; // also defines the htlc redeemAddress in SetupSwapSuccess
            }

            return nimProxyKey;
        })();
        // Catch errors to avoid uncaught promise rejections but ignore them and just keep errors displayed in LedgerUi.
        this._nimiqProxyKeyPromise.catch(() => void 0);
    }

    protected destroyed() {
        this._isDestroyed = true;
        LedgerApi.disconnect(
            /* cancelRequest */ true,
            /* requestTypesToDisconnect */ [
                LedgerApiRequestTypeNimiq.GET_PUBLIC_KEY,
                LedgerApiRequestTypeNimiq.SIGN_TRANSACTION,
                LedgerApiRequestTypeBitcoin.SIGN_TRANSACTION,
            ],
        );
    }

    protected async _collectSwapSetupInfo(): Promise<SwapSetupInfo | null> {
        // super._collectSwapSetupInfo doesn't work
        const swapSetupInfo = await (this.constructor as any).superOptions.methods._collectSwapSetupInfo.call(this);
        if (!swapSetupInfo) return null;

        // Replace nim address by the proxy's address.
        let nimProxyKey: Nimiq.KeyPair;
        try {
            nimProxyKey = await this._nimiqProxyKeyPromise;
        } catch (e) {
            return null;
        }
        const proxyAddress = nimProxyKey.publicKey.toAddress().serialize();
        if (swapSetupInfo.fund.type === SwapAsset.NIM) {
            swapSetupInfo.fund.sender = proxyAddress;
            swapSetupInfo.fund.senderType = Nimiq.Account.Type.BASIC;
        } else if (swapSetupInfo.redeem.type === SwapAsset.NIM) {
            swapSetupInfo.redeem.recipient = proxyAddress;
        }

        return swapSetupInfo;
    }

    protected async _shouldConfirmSwap() {
        if (this._isDestroyed) return false;
        try {
            await Promise.all([
                // await first step of swap setup
                this._setupSwapPromise,
                // This requires the user to connect and unlock his ledger which also shows that the user intends to
                // actually do the swap.
                this._nimiqProxyKeyPromise,
            ]);
        } catch (e) {
            return false;
        }
        return !this._isDestroyed;
    }

    protected async _signSwapTransactions(htlcInfo: SwapHtlcInfo)
        : Promise<{ nim: Nimiq.Transaction, nimProxy?: Nimiq.Transaction, btc: SignedBtcTransaction } | null> {
        if (this._isDestroyed) return null;
        let swapSetupInfo: SwapSetupInfo;
        let nimiqProxyKey: Nimiq.KeyPair;
        let Buffer: typeof import('buffer').Buffer;
        try {
            [swapSetupInfo, nimiqProxyKey] = await Promise.all([
                this._setupSwapPromise,
                this._nimiqProxyKeyPromise,
                loadBitcoinJS(),
            ]);
            // note that buffer is marked as external module in vue.config.js and internally, the buffer bundled with
            // BitcoinJS is used, therefore we retrieve it after having BitcoinJS loaded.
            // TODO change this when we don't prebuild BitcoinJS anymore
            Buffer = await import('buffer').then((module) => module.Buffer);
        } catch (e) {
            return null;
        }

        if (this._isDestroyed) return null;

        // Collect nimiq swap transaction info

        let nimiqSwapTransactionInfo: Parameters<Network['createTx']>[0]; // currently signed by proxy, not Ledger
        let nimiqProxyTransactionInfo: LedgerNimiqTransactionInfo & Parameters<Network['createTx']>[0] | undefined;
        if (this.request.fund.type === SwapAsset.NIM
            && swapSetupInfo.fund.type === SwapAsset.NIM
            && htlcInfo.fund.type === SwapAsset.NIM) {
            nimiqSwapTransactionInfo = {
                signerPubKey: nimiqProxyKey.publicKey,
                sender: new Nimiq.Address(swapSetupInfo.fund.sender),
                senderType: swapSetupInfo.fund.senderType,
                recipient: Nimiq.Address.CONTRACT_CREATION, // htlc creation
                recipientType: Nimiq.Account.Type.HTLC,
                value: swapSetupInfo.fund.value,
                fee: swapSetupInfo.fund.fee,
                validityStartHeight: swapSetupInfo.fund.validityStartHeight,
                // network: Config.network, // enable when signed by Ledger
                flags: Nimiq.Transaction.Flag.CONTRACT_CREATION,
                data: htlcInfo.fund.htlcData, // for proxy via createTx and getUnrelayedTransactions
                // extraData: htlcInfo.fund.htlcData, // for LedgerApi; unset as Ledger does not sign this tx currently
            };
            // funding tx from Ledger to proxy address
            nimiqProxyTransactionInfo = {
                signerPubKey: nimiqProxyKey.publicKey, // anything, unused as signed by Ledger
                sender: this.nimiqLedgerAddressInfo.address,
                recipient: nimiqProxyKey.publicKey.toAddress(),
                value: swapSetupInfo.fund.value,
                validityStartHeight: swapSetupInfo.fund.validityStartHeight,
                network: Config.network,
                // data: ProxyExtraData.FUND, // for createTx and getUnrelayedTransactions; unset as signed by Ledger
                extraData: ProxyExtraData.FUND, // for LedgerApi
            };
        } else if (this.request.redeem.type === SwapAsset.NIM
            && swapSetupInfo.redeem.type === SwapAsset.NIM
            && htlcInfo.redeem.type === SwapAsset.NIM) {
            // The htlc redeem tx currently has to be signed by the proxy but doesn't have to forward funds through it.
            nimiqSwapTransactionInfo = {
                signerPubKey: nimiqProxyKey.publicKey,
                sender: Nimiq.Address.fromString(htlcInfo.redeem.htlcAddress),
                senderType: Nimiq.Account.Type.HTLC,
                recipient: this.nimiqLedgerAddressInfo.address,
                value: swapSetupInfo.redeem.value,
                fee: swapSetupInfo.redeem.fee,
                validityStartHeight: swapSetupInfo.redeem.validityStartHeight,
                // network: Config.network, // enable when signed by Ledger
            };
        } else {
            throw new Error('Could not find NIM transaction data');
        }

        // Collect bitcoin swap transaction info

        let bitcoinTransactionInfo: Parameters<typeof prepareBitcoinTransactionForLedgerSigning>[0];
        const bitcoinNetwork = Config.bitcoinNetwork === BTC_NETWORK_TEST
            ? BitcoinJS.networks.testnet
            : BitcoinJS.networks.bitcoin;
        if (this.request.fund.type === SwapAsset.BTC
            && swapSetupInfo.fund.type === SwapAsset.BTC
            && htlcInfo.fund.type === SwapAsset.BTC) {
            const htlcAddress = BitcoinJS.payments.p2wsh({
                witness: [Buffer.from(htlcInfo.fund.htlcScript)],
                network: bitcoinNetwork,
            }).address;

            if (!htlcAddress) {
                throw new Error('Cannot derive HTLC address from BTC HTLC script');
            }

            bitcoinTransactionInfo = {
                inputs: swapSetupInfo.fund.inputs,
                recipientOutput: {
                    ...swapSetupInfo.fund.recipientOutput,
                    address: htlcAddress,
                },
                ...(this.request.fund.changeOutput && swapSetupInfo.fund.changeOutput ? {
                    changeOutput: {
                        ...swapSetupInfo.fund.changeOutput,
                        address: this.request.fund.changeOutput.address,
                    },
                } : {}),
            };
        } else if (this.request.redeem.type === SwapAsset.BTC
            && swapSetupInfo.redeem.type === SwapAsset.BTC
            && htlcInfo.redeem.type === SwapAsset.BTC) {
            bitcoinTransactionInfo = {
                inputs: [{ // the htlc is our single input
                    keyPath: swapSetupInfo.redeem.input.keyPath,
                    transactionHash: htlcInfo.redeem.transactionHash,
                    outputIndex: htlcInfo.redeem.outputIndex,
                    witnessScript: Nimiq.BufferUtils.toHex(htlcInfo.redeem.htlcScript),
                }],
                recipientOutput: {
                    ...swapSetupInfo.redeem.output,
                    address: this.request.redeem.output.address,
                },
                // no change output
            };
        } else {
            throw new Error('Could not find BTC transaction data');
        }

        // prepare btc transaction for ledger signing
        const preparedBitcoinTransactionInfoPromise = prepareBitcoinTransactionForLedgerSigning(bitcoinTransactionInfo);

        // sign transactions

        let signedNimiqSwapTransaction: Nimiq.Transaction;
        let signedNimiqProxyTransaction: Nimiq.Transaction | undefined;
        let nimiqSendPromise: Promise<any> = Promise.resolve();
        let signedBitcoinTransactionHex: string;
        try {
            if (this._isDestroyed) return null;

            // First sign Nim transaction as user is already connected to nimiq app and to give time for proxy funding

            if (swapSetupInfo.fund.type === SwapAsset.NIM && nimiqProxyTransactionInfo) {
                // send funding tx from Ledger to proxy address
                signedNimiqProxyTransaction = this.nimiqNetwork.getUnrelayedTransactions(nimiqProxyTransactionInfo)[0];
                if (!signedNimiqProxyTransaction) {
                    signedNimiqProxyTransaction = await LedgerApi.Nimiq.signTransaction(
                        nimiqProxyTransactionInfo,
                        this._account.findSignerForAddress(this.nimiqLedgerAddressInfo.address)!.path,
                        this._account.keyId,
                    );
                }
                // ignore broadcast errors. The Wallet will also try to send the tx
                nimiqSendPromise = this.nimiqNetwork.sendToNetwork(signedNimiqProxyTransaction).catch(() => void 0);
            } else if (swapSetupInfo.redeem.type === SwapAsset.NIM) {
                // For redeeming, the htlc swap transaction is signed by the proxy. Nonetheless, we let the user sign an
                // unused dummy transaction for ux consistency. This transaction is signed from a keyPath which does not
                // actually hold funds.
                const dummyTransaction = {
                    ...nimiqSwapTransactionInfo,
                    sender: nimiqSwapTransactionInfo.sender instanceof Nimiq.Address
                        ? nimiqSwapTransactionInfo.sender
                        : new Nimiq.Address(nimiqSwapTransactionInfo.sender),
                    senderType: undefined, // Ledgers can't sign htlc senders yet
                    recipient: nimiqSwapTransactionInfo.recipient instanceof Nimiq.Address
                        ? nimiqSwapTransactionInfo.recipient
                        : new Nimiq.Address(nimiqSwapTransactionInfo.recipient),
                };
                await LedgerApi.Nimiq.signTransaction(
                    dummyTransaction,
                    // Any unused key path; We use LEDGER_HTLC_PROXY_KEY_PATH here but note that this is different from
                    // the proxy account as the proxy account is derived from the public key. Also note that this signed
                    // tx should not be exposed to not expose the public key.
                    LEDGER_HTLC_PROXY_KEY_PATH,
                    this._account.keyId,
                );
            } else {
                throw new Error('Could not find NIM transaction data');
            }

            // Sign swap transaction by proxy
            signedNimiqSwapTransaction = await this.nimiqNetwork.createTx(nimiqSwapTransactionInfo);
            signedNimiqSwapTransaction.proof = Nimiq.SignatureProof.singleSig(
                nimiqProxyKey.publicKey,
                Nimiq.Signature.create(
                    nimiqProxyKey.privateKey,
                    nimiqProxyKey.publicKey,
                    signedNimiqSwapTransaction.serializeContent(),
                ),
            ).serialize();

            if (this._isDestroyed) return null;

            // Then sign the Btc transaction

            let preparedBitcoinTransactionInfo: LedgerBitcoinTransactionInfo;
            try {
                preparedBitcoinTransactionInfo = await preparedBitcoinTransactionInfoPromise;
            } catch (e) {
                this.error = e.message || e;
                return null;
            }

            signedBitcoinTransactionHex = await LedgerApi.Bitcoin.signTransaction(preparedBitcoinTransactionInfo);
        } catch (e) {
            // If cancelled reject. Otherwise just keep the ledger ui / error message displayed.
            if (e.message.toLowerCase().indexOf('cancelled') !== -1) throw new Error(ERROR_CANCELED);
            return null;
        }
        const signedBitcoinTransaction = BitcoinJS.Transaction.fromHex(signedBitcoinTransactionHex);

        // set htlc witness for redeeming the BTC htlc. For Nimiq, the htlc proof is set in SetupSwapSuccess.

        if (swapSetupInfo.redeem.type === SwapAsset.BTC && htlcInfo.redeem.type === SwapAsset.BTC) {
            const htlcInput = signedBitcoinTransaction.ins[0];
            // get signature and signer pub key from default witness generated by ledgerjs (see @ledgerhq/hw-app-btc
            // createTransaction.js creation of the witness towards the end of createTransaction)
            const [inputSignature, signerPubKey] = htlcInput.witness;

            const witnessBytes = BitcoinJS.script.fromASM([
                inputSignature.toString('hex'),
                signerPubKey.toString('hex'),
                // Use zero-bytes as a dummy secret which are replaced in the wallet once the swap secret is known
                '0000000000000000000000000000000000000000000000000000000000000000',
                'OP_1', // OP_1 (true) activates the redeem branch in the HTLC script
                Nimiq.BufferUtils.toHex(htlcInfo.redeem.htlcScript),
            ].join(' '));

            const witnessStack = BitcoinJS.script.toStack(witnessBytes);
            signedBitcoinTransaction.setWitness(0, witnessStack);
        }

        this.state = this.State.FINISHED;
        await nimiqSendPromise;

        return {
            nim: signedNimiqSwapTransaction,
            nimProxy: signedNimiqProxyTransaction,
            btc: {
                serializedTx: signedBitcoinTransaction.toHex(),
                hash: signedBitcoinTransaction.getId(),
            },
        };
    }

    protected _statusScreenActionHandler() {
        window.location.reload();
    }

    // Getters for displaying information

    protected get statusScreenTitle() {
        switch (this.state) {
            case this.State.FETCHING_SWAP_DATA_FAILED:
                return this.$t('Swap Setup Failed') as string;
            case this.State.SYNCING_FAILED:
                return this.$t('Syncing Failed') as string;
            default:
                return ''; // don't display a title in small ui state
        }
    }

    protected get statusScreenStatus() {
        // Other than SetupSwapSuccess do no show a status for FETCHING_SWAP_DATA and SIGNING_TRANSACTIONS as during
        // these states typically the LedgerUi is / was just active and the StatusScreen will fade.
        if (this.state !== this.State.SYNCING) return '';
        return this.$t('Syncing with Bitcoin network...') as string;
    }

    private get _fundingAmountInfo(): SwapAmountInfo {
        const { fund: fundInfo, serviceFundingFee, bitcoinAccount, fundingFiatRate: fiatRate } = this.request;
        const { type: currency } = fundInfo;
        let currencyDecimals: number;
        let myAmount: number; // what we are paying including fees
        let fees: number;
        let newBalance: number | undefined;
        switch (fundInfo.type) {
            case SwapAsset.NIM:
                currencyDecimals = 5;
                fees = fundInfo.fee + serviceFundingFee;
                myAmount = fundInfo.value + fundInfo.fee;
                newBalance = this.nimiqLedgerAddressInfo.balance - myAmount;
                break;
            case SwapAsset.BTC:
                currencyDecimals = 8;
                const { inputs, output, changeOutput } = fundInfo;
                const inputsValue = inputs.reduce((sum, { value }) => sum + value, 0);
                fees = (inputsValue - output.value - (changeOutput ? changeOutput.value : 0)) // inputs minus outputs
                    + serviceFundingFee;
                myAmount = inputsValue - (changeOutput ? changeOutput.value : 0);
                newBalance = bitcoinAccount ? bitcoinAccount.balance - myAmount : undefined;
                break;
            default:
                throw new Error(`Unsupported currency ${currency}`);
        }
        const theirAmount = myAmount - fees; // what the other party receives excluding fees
        return { myAmount, theirAmount, fees, currency, currencyDecimals, newBalance, fiatRate };
    }

    private get _redeemingAmountInfo(): SwapAmountInfo {
        const { redeem: redeemInfo, serviceRedeemingFee, bitcoinAccount, redeemingFiatRate: fiatRate } = this.request;
        const { type: currency } = redeemInfo;
        let currencyDecimals: number;
        let myAmount: number; // what we receive excluding fees
        let fees: number;
        let newBalance: number | undefined;
        switch (redeemInfo.type) {
            case SwapAsset.NIM:
                currencyDecimals = 5;
                myAmount = redeemInfo.value;
                fees = redeemInfo.fee + serviceRedeemingFee;
                newBalance = this.nimiqLedgerAddressInfo.balance + myAmount;
                break;
            case SwapAsset.BTC:
                currencyDecimals = 8;
                const { input, output } = redeemInfo;
                myAmount = output.value;
                fees = input.value - output.value // inputs minus outputs
                    + serviceRedeemingFee;
                newBalance = bitcoinAccount ? bitcoinAccount.balance + myAmount : undefined;
                break;
            default:
                throw new Error(`Unsupported currency ${currency}`);
        }
        const theirAmount = myAmount + fees; // what the other party pays including fees
        return { myAmount, theirAmount, fees, currency, currencyDecimals, newBalance, fiatRate };
    }

    private get _baseAmountInfo(): SwapAmountInfo {
        // alias for _fundingAmountInfo or _redeemingAmountInfo for easier lookup
        const { fund: { type: fundingCurrency }, redeem: { type: redeemingCurrency } } = this.request;
        const swapCurrencies = [fundingCurrency, redeemingCurrency];
        let swapBase: SwapAsset;
        if (swapCurrencies.includes(SwapAsset.NIM)) {
            swapBase = SwapAsset.NIM; // Nim if Nim is involved
        } else {
            swapBase = swapCurrencies.find((currency) => currency !== SwapAsset.EUR)!; // the non-fiat currency
        }
        return [this._fundingAmountInfo, this._redeemingAmountInfo].find((info) => info.currency === swapBase)!;
    }

    private get _otherAmountInfo(): SwapAmountInfo {
        // alias for _fundingAmountInfo or _redeemingAmountInfo for easier lookup
        return [this._fundingAmountInfo, this._redeemingAmountInfo].find((info) => info !== this._baseAmountInfo)!;
    }

    private get _amountInfoForCurrency(): Partial<Record<SwapAsset, SwapAmountInfo>> {
        // alias for _fundingAmountInfo and _redeemingAmountInfo for easier lookup
        const amountInfoForCurrency: Partial<Record<SwapAsset, SwapAmountInfo>> = {};
        amountInfoForCurrency[this._fundingAmountInfo.currency] = this._fundingAmountInfo;
        amountInfoForCurrency[this._redeemingAmountInfo.currency] = this._redeemingAmountInfo;
        return amountInfoForCurrency;
    }

    private get _totalFiatFees(): number {
        return this._toFiat(this._fundingAmountInfo.fees, this._fundingAmountInfo.currency)
            + this._toFiat(this._redeemingAmountInfo.fees, this._redeemingAmountInfo.currency)
            + this._toFiat(this.request.serviceSwapFee, this._fundingAmountInfo.currency); // in funding currency
    }

    private get _formattedExchangeRate(): string {
        // how much is one coin of the base currency in the other currency (based on theirAmount as the exchange is
        // determined on their side)?
        const exchangeRate = this._toCoins(this._otherAmountInfo.theirAmount, this._otherAmountInfo.currency)
            / this._toCoins(this._baseAmountInfo.theirAmount, this._baseAmountInfo.currency);
        // Round to _otherAmountInfo.currencyDecimals + 1 decimals and avoid displaying a better exchange rate than the
        // actual one by flooring / ceiling in the worse direction instead of rounding, depending on whether we are
        // paying or receiving the base currency. Add or subtract a small epsilon to avoid rounding up or down due to
        // floating point imprecision.
        const roundingFactor = 10 ** (this._otherAmountInfo.currencyDecimals + 1);
        const roundedExchangeRate = this._fundingAmountInfo === this._baseAmountInfo
            // when funding, a lower rate is worse (receives less of other currency for same amount of base currency)
            ? Math.floor(exchangeRate * roundingFactor + 1e-10) / roundingFactor
            // when redeeming, a higher rate is worse (pays more of other currency for same amount of base currency)
            : Math.ceil(exchangeRate * roundingFactor - 1e-10) / roundingFactor;
        return `1 ${this._baseAmountInfo.currency} = `
            + `${new FormattableNumber(roundedExchangeRate).toString(true)} ${this._otherAmountInfo.currency}`;
    }

    private get _formattedServiceFee(): string {
        const { serviceSwapFee } = this.request; // in funding currency
        const relativeServiceFees = serviceSwapFee / (this._fundingAmountInfo.theirAmount - serviceSwapFee);
        // Convert to percent and round to two decimals. Always ceil to avoid displaying a lower fee than charged.
        // Subtract a small epsilon to avoid that numbers get rounded up as a result of floating point imprecision after
        // multiplication. Otherwise formatting for example .07 would result in 7.01%.
        return `${Math.ceil(relativeServiceFees * 100 * 100 - 1e-10) / 100}%`;
    }

    private get _balanceBarEntries(): BalanceBarEntry[] {
        if (this.request.layout !== 'slider'
            || !this.request.nimiqAddresses
            || !this.request.bitcoinAccount
            || !this._amountInfoForCurrency[SwapAsset.NIM]
            || !this._amountInfoForCurrency[SwapAsset.BTC]
        ) return [];
        return [
            ...this.request.nimiqAddresses.map(({ address, balance }) => {
                const nimiqAddress = Nimiq.Address.fromAny(address);
                const oldFiatBalance = this._toFiat(balance, SwapAsset.NIM);
                return {
                    currency: SwapAsset.NIM,
                    background: identiconBackgroundColors[identiconColorNames.indexOf(
                        getIdenticonBackgroundColorName(nimiqAddress.toUserFriendlyAddress()),
                    )],
                    oldFiatBalance,
                    newFiatBalance: nimiqAddress.equals(this.nimiqLedgerAddressInfo.address)
                        ? this._toFiat(this._amountInfoForCurrency[SwapAsset.NIM]!.newBalance!, SwapAsset.NIM)
                        : oldFiatBalance,
                };
            }), {
                currency: SwapAsset.BTC,
                background: '#F7931A', // Bitcoin orange
                oldFiatBalance: this._toFiat(this.request.bitcoinAccount.balance, SwapAsset.BTC),
                newFiatBalance: this._toFiat(this._amountInfoForCurrency[SwapAsset.BTC]!.newBalance!, SwapAsset.BTC),
            },
        ];
    }

    private _toCoins(amount: number, currency: SwapAsset) {
        switch (currency) {
            case SwapAsset.NIM: return Nimiq.Policy.lunasToCoins(amount);
            case SwapAsset.BTC: return satoshisToCoins(amount);
            case SwapAsset.EUR: return amount / 100;
            default: throw new Error(`Invalid currency ${currency}`);
        }
    }

    private _toFiat(amount: number, currency: SwapAsset) {
        const coins = this._toCoins(amount, currency);
        if (currency === SwapAsset.EUR) return coins;
        const amountInfoForCurrency = this._amountInfoForCurrency[currency];
        if (!amountInfoForCurrency) throw new Error(`Unknown fiat rate for ${currency}`);
        return coins * amountInfoForCurrency.fiatRate;
    }

    private _close() {
        if (this.state === this.State.FINISHED) return;
        this.$rpc.reject(new Error(ERROR_CANCELED));
    }
}
</script>

<style scoped>
    .small-page {
        position: relative;
        min-width: 63.5rem;
        padding-bottom: 24rem; /* for bottom container + additional padding */
    }

    .page-header {
        padding-bottom: 3rem;
    }

    .page-header .tooltip {
        margin-top: 2rem;
        text-align: left;
        vertical-align: bottom;
    }

    .page-header .tooltip:not(:first-of-type) {
        margin-left: .75rem;
    }

    .page-header .tooltip >>> .trigger {
        padding: 0.75rem 1.5rem;
        border-radius: 5rem;
        font-size: 1.75rem;
        font-weight: 600;
        color: rgba(31, 35, 72, .6); /* nq-blue with .6 opacity */
        box-shadow: rgba(31, 35, 72, .15) 0 0 0 1.5px inset;
    }

    .page-header .tooltip >>> .tooltip-box {
        font-size: 2rem;
    }

    .exchange-rate-tooltip >>> .tooltip-box {
        min-width: 19.5rem;
        line-height: 1.3;
    }

    .fee-tooltip >>> .tooltip-box {
        display: grid;
        grid-template-columns: 1fr auto;
        column-gap: 1rem;
        row-gap: 1rem;
        width: 32.5rem;
        padding-left: 2rem;
        padding-right: 2rem;
        white-space: nowrap;
    }

    .fee-tooltip .fiat-amount {
        justify-self: right;
    }

    .fee-tooltip .explainer {
        grid-column: span 2;
        margin-top: -1rem;
        font-size: 1.75rem;
        white-space: normal;
        opacity: .6;
    }

    .fee-tooltip hr {
        grid-column: span 2;
        margin: .75rem -1rem .5rem;
        border: unset;
        border-top: 1px solid white;
        opacity: .2;
    }

    .fee-tooltip .total {
        font-weight: bold;
    }

    .page-body {
        padding-bottom: 0;
    }

    .address-infos,
    .swap-values,
    .new-balances {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .address-infos > .identicon {
        width: 5.75rem;
        height: 5.75rem;
        margin: -.25rem 0;
    }

    .address-infos > img {
        width: 5.25rem;
        height: 5.25rem;
    }

    .address-infos > label {
        max-width: calc(50% - 5.75rem - 3rem); /* minus identicon width and margin */
        margin: 0 1.5rem;
        font-size: 2rem;
        font-weight: 600;
        line-height: 1.3;
    }

    .address-infos > label:first-of-type {
        margin-right: auto;
    }

    .balance-bar {
        display: flex;
        align-items: center;
        height: 3.5rem;
        margin: 2.75rem 0 4rem;
    }

    .balance-bar > :not(:last-child) {
        margin-right: 0.375rem;
    }

    .balance-bar .bar {
        position: relative;
        height: 2.5rem;
        border-radius: 0.5rem;
        border-width: .25rem;
        border-style: solid;
        overflow: hidden;
    }

    .balance-bar .bar:first-child {
        border-top-left-radius: 2rem;
        border-bottom-left-radius: 2rem;
    }

    .balance-bar .bar:last-child {
        border-top-right-radius: 2rem;
        border-bottom-right-radius: 2rem;
    }

    .balance-bar .bar .change {
        position: absolute;
        height: 100%;
        right: 0;
        border-radius: 0.125rem;
        background: url('/swap-change-background.svg') repeat-x;
    }

    .balance-bar .separator ~ .bar .change {
        left: 0;
        right: unset;
    }

    .balance-bar .separator {
        width: 0.25rem;
        height: 100%;
        background: rgba(31, 35, 72, 0.3);
        border-radius: .125rem;
    }

    .swap-values {
        margin-bottom: 2rem;
    }

    .swap-values > *,
    .new-balances > * {
        display: flex;
        flex-direction: column;
        line-height: 1;
    }

    .swap-values > :last-child,
    .new-balances > :last-child {
        text-align: right;
    }

    .swap-values .amount,
    .new-balances .amount {
        font-size: 2.5rem;
        font-weight: bold;
    }

    .swap-values .fiat-amount,
    .new-balances .fiat-amount {
        margin-top: .5rem;
        font-size: 2rem;
        font-weight: 600;
        opacity: .4;
    }

    .swap-values .redeeming {
        color: var(--nimiq-green);
    }

    .swap-values .redeeming .amount::before {
        content: '+';
    }

    .swap-values :not(.redeeming) .amount::before {
        content: '-';
    }

    .swap-values .redeeming .fiat-amount {
        opacity: .7;
    }

    .bottom-container {
        position: absolute;
        width: 100%;
        height: 23rem;
        bottom: 0;
        transition: height .4s;
    }

    .bottom-container.full-height {
        height: 100%;
    }

    .bottom-container > * {
        position: absolute;
        top: 0;
    }

    .status-screen {
        transition: opacity .4s;
        overflow: hidden;
    }

    .ledger-ui >>> .loading-spinner {
        margin-top: -1.25rem; /* position at same position as StatusScreen's loading spinner */
    }
</style>
