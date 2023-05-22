import type { RelayRequest } from '@opengsn/common/dist/EIP712/RelayRequest';
import type { Currency, PaymentType, RequestType, CashlinkTheme } from '../../client/PublicRequestTypes';
import type { ParsedPaymentOptions } from './paymentOptions/ParsedPaymentOptions';
import type { ParsedNimiqSpecifics, ParsedNimiqDirectPaymentOptions } from './paymentOptions/NimiqPaymentOptions';
import type { ParsedEtherSpecifics, ParsedEtherDirectPaymentOptions } from './paymentOptions/EtherPaymentOptions';
import type { ParsedBitcoinSpecifics, ParsedBitcoinDirectPaymentOptions } from './paymentOptions/BitcoinPaymentOptions';
import type { SwapAsset } from '@nimiq/fastspot-api';
import type { FiatApiSupportedFiatCurrency } from '@nimiq/utils';

export interface ParsedBasicRequest {
    kind: RequestType;
    appName: string;
}

export interface ParsedSimpleRequest extends ParsedBasicRequest {
    walletId: string;
}

export interface ParsedOnboardRequest extends ParsedBasicRequest {
    disableBack: boolean;
}

export interface ParsedChooseAddressRequest extends ParsedBasicRequest {
    returnBtcAddress: boolean;
    returnUsdcAddress: boolean;
    minBalance: number;
    disableContracts: boolean;
    disableLegacyAccounts: boolean;
    disableBip39Accounts: boolean;
    disableLedgerAccounts: boolean;
}

export interface ParsedSignTransactionRequest extends ParsedBasicRequest {
    // The sender object is currently only for internal use in RefundSwapLedger and can not be set in public request.
    // Note that the object does not get exported to the history state in RpcApi and therefore does not survive reloads.
    // However, the RefundSwapLedger handler is built in a way that it starts over on reloads to avoid the problem.
    sender: Nimiq.Address | {
        address: Nimiq.Address,
        label?: string,
        walletLabel?: string,
        type?: Nimiq.Account.Type,
        signerKeyId: string,
        signerKeyPath: string,
    };
    recipient: Nimiq.Address;
    recipientType: Nimiq.Account.Type;
    recipientLabel?: string;
    value: number;
    fee: number;
    data: Uint8Array;
    flags: number;
    validityStartHeight: number; // FIXME To be made optional when hub has its own network
}

export interface ParsedMultisigInfo {
    publicKeys: Uint8Array[];
    numberOfSigners: number;
    signerPublicKeys: Uint8Array[]; // Can be omitted when all publicKeys need to sign
    secret: {
        aggregatedSecret: Uint8Array;
    } | {
        encryptedSecrets: Uint8Array[];
        bScalar: Uint8Array;
    };
    aggregatedCommitment: Uint8Array;
    userName?: string;
}

export interface ParsedSignMultisigTransactionRequest extends ParsedBasicRequest {
    signer: Nimiq.Address;

    sender: Nimiq.Address;
    senderLabel: string;
    recipient: Nimiq.Address;
    recipientType?: Nimiq.Account.Type;
    recipientLabel?: string;
    value: number;
    fee?: number;
    data?: Uint8Array;
    flags?: number;
    validityStartHeight: number; // FIXME To be made optional when hub has its own network

    multisigConfig: ParsedMultisigInfo;
}

export type ParsedProtocolSpecificsForCurrency<C extends Currency> =
    C extends Currency.NIM ? ParsedNimiqSpecifics
    : C extends Currency.BTC ? ParsedBitcoinSpecifics
    : C extends Currency.ETH ? ParsedEtherSpecifics
    : undefined;

export type AvailableParsedPaymentOptions = ParsedNimiqDirectPaymentOptions
                                          | ParsedEtherDirectPaymentOptions
                                          | ParsedBitcoinDirectPaymentOptions;

export type ParsedPaymentOptionsForCurrencyAndType<C extends Currency, T extends PaymentType> =
    T extends PaymentType.DIRECT ?
        C extends Currency.NIM ? ParsedNimiqDirectPaymentOptions
        : C extends Currency.BTC ? ParsedBitcoinDirectPaymentOptions
        : C extends Currency.ETH ? ParsedEtherDirectPaymentOptions
        : ParsedPaymentOptions<C, T>
    : ParsedPaymentOptions<C, T>;

export interface ParsedCheckoutRequest extends ParsedBasicRequest {
    version: number;
    shopLogoUrl?: string;
    callbackUrl?: string;
    csrf?: string;
    time: number;
    fiatCurrency?: string;
    fiatAmount?: number;
    paymentOptions: AvailableParsedPaymentOptions[];
    isPointOfSale: boolean;
    disableDisclaimer: boolean;
}

export interface ParsedSignMessageRequest extends ParsedBasicRequest {
    signer?: Nimiq.Address;
    message: string | Uint8Array;
}

export interface ParsedRenameRequest extends ParsedSimpleRequest {
    address?: string;
}

export interface ParsedExportRequest extends ParsedSimpleRequest {
    fileOnly?: boolean;
    wordsOnly?: boolean;
}

export interface ParsedCreateCashlinkRequest extends ParsedBasicRequest {
    senderAddress?: Nimiq.Address;
    senderBalance?: number;
    value?: number;
    message?: string;
    theme: CashlinkTheme;
    fiatCurrency?: FiatApiSupportedFiatCurrency;
    returnLink: boolean;
    skipSharing: boolean;
}

export interface ParsedManageCashlinkRequest extends ParsedBasicRequest {
    cashlinkAddress: Nimiq.Address;
}

/**
 * Bitcoin
 */

export interface ParsedSignBtcTransactionRequest extends ParsedSimpleRequest {
    inputs: Array<{
        address: string,
        transactionHash: string,
        outputIndex: number,
        outputScript: string, // hex
        witnessScript?: string, // Custom witness script for p2wsh input. hex.
        value: number,
        sequence?: number,
        // Currently only for internal use in RefundSwapLedger. Can not be set in public request.
        // Note that the keyPath gets lost on re-parsing in RequestParser and therefore does not survive reloads.
        // However, the RefundSwapLedger handler is built in a way that it starts over on reloads to avoid the problem.
        keyPath?: string,
    }>;
    output: {
        address: string,
        value: number,
        label?: string,
    };
    changeOutput?: {
        address: string,
        value: number,
    };
    locktime?: number;
}

export interface ParsedAddBtcAddressesRequest extends ParsedSimpleRequest {
    chain: 'internal' | 'external';
    firstIndex: number;
}

/**
 * Polygon
 */

export interface ParsedSignPolygonTransactionRequest extends ParsedBasicRequest, RelayRequest {
    recipientLabel?: string;
    tokenApprovalNonce?: number;
}

/**
 * Swap
 */

export interface ParsedSetupSwapRequest extends ParsedSimpleRequest {
    swapId: string;

    fund: {
        type: SwapAsset.NIM,
        sender: Nimiq.Address,
        value: number, // Luna
        fee: number, // Luna
        // extraData: Uint8Array, // HTLC data
        validityStartHeight: number,
    } | {
        type: SwapAsset.BTC,
        inputs: Array<{
            address: string,
            transactionHash: string,
            outputIndex: number,
            outputScript: string,
            value: number, // Sats
            sequence?: number,
        }>;
        output: {
            // address: string, // HTLC address
            value: number, // Sats
        };
        changeOutput?: {
            address: string,
            value: number, // Sats
        };
        locktime?: number,
        // htlcScript: Uint8Array,
        refundAddress: string,
    } | ({
        type: SwapAsset.USDC,
        approval?: {
            tokenNonce: number,
        },
    } & RelayRequest) | {
        type: SwapAsset.EUR,
        value: number, // Eurocents
        fee: number, // Eurocents
        bankLabel?: string,
    };

    redeem: {
        type: SwapAsset.NIM,
        // sender: Nimiq.Address, // HTLC address
        recipient: Nimiq.Address, // My address, must be redeem address of HTLC
        value: number, // Luna
        fee: number, // Luna
        extraData?: Uint8Array,
        validityStartHeight: number,
        // htlcData: Uint8Array,
    } | {
        type: SwapAsset.BTC,
        input: {
            // transactionHash: string,
            // outputIndex: number,
            // outputScript: string,
            value: number, // Sats
            // witnessScript: string,
        };
        output: {
            address: string, // My address, must be redeem address of HTLC
            value: number, // Sats
        };
    } | ({
        type: SwapAsset.USDC,
        amount: number,
    } & RelayRequest) | {
        type: SwapAsset.EUR,
        value: number; // Eurocents
        fee: number; // Eurocents
        bankLabel?: string;
        settlement: {
            type: 'sepa',
            recipient: {
                name: string,
                iban: string,
                bic: string,
            },
        } | {
            type: 'mock',
        };
    };

    // Data needed for display
    layout: 'standard' | 'slider';
    fiatCurrency: string;
    fundingFiatRate: number;
    redeemingFiatRate: number;
    fundFees: { // In the currency that gets funded
        processing: number,
        redeeming: number,
    };
    redeemFees: { // In the currency that gets redeemed
        funding: number,
        processing: number,
    };
    serviceSwapFee: number; // Luna or Sats, depending which one gets funded
    direction?: 'left-to-right' | 'right-to-left';
    nimiqAddresses?: Array<{
        address: string,
        balance: number, // Luna
    }>;
    bitcoinAccount?: {
        balance: number, // Sats
    };
    polygonAddresses?: Array<{
        address: string,
        balance: number, // Luna
    }>;

    // Optional KYC info for swapping at higher limits
    kyc?: {
        provider: 'TEN31 Pass',
        userId: string,
        s3GrantToken: string,
        oasisGrantToken?: string,
    };
}

export interface ParsedRefundSwapRequest extends ParsedSimpleRequest {
    refund: {
        type: SwapAsset.NIM;
        sender: Nimiq.Address; // HTLC address
        recipient: Nimiq.Address; // My address, must be refund address of HTLC
        value: number; // Luna
        fee: number; // Luna
        extraData?: Uint8Array;
        validityStartHeight: number;
    } | {
        type: SwapAsset.BTC;
        input: {
            transactionHash: string,
            outputIndex: number,
            outputScript: string,
            value: number, // Sats
            witnessScript: string,
        };
        output: {
            address: string, // My address
            value: number, // Sats
        };
        refundAddress: string; // My address, must be refund address of HTLC
    } | ({
        type: SwapAsset.USDC,
        amount: number,
    } & RelayRequest);
}

// Discriminated Unions
export type ParsedRpcRequest = ParsedSignTransactionRequest
                             | ParsedCreateCashlinkRequest
                             | ParsedManageCashlinkRequest
                             | ParsedCheckoutRequest
                             | ParsedBasicRequest
                             | ParsedSimpleRequest
                             | ParsedOnboardRequest
                             | ParsedRenameRequest
                             | ParsedSignMessageRequest
                             | ParsedExportRequest
                             | ParsedSignBtcTransactionRequest
                             | ParsedAddBtcAddressesRequest
                             | ParsedSignPolygonTransactionRequest
                             | ParsedSetupSwapRequest
                             | ParsedRefundSwapRequest;
