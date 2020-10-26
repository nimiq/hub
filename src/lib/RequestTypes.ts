import { Currency, PaymentType, RequestType } from './PublicRequestTypes';
import { ParsedPaymentOptions } from './paymentOptions/ParsedPaymentOptions';
import { ParsedNimiqSpecifics, ParsedNimiqDirectPaymentOptions } from './paymentOptions/NimiqPaymentOptions';
import { ParsedEtherSpecifics, ParsedEtherDirectPaymentOptions } from './paymentOptions/EtherPaymentOptions';
import { ParsedBitcoinSpecifics, ParsedBitcoinDirectPaymentOptions } from './paymentOptions/BitcoinPaymentOptions';
import { CashlinkTheme } from './PublicRequestTypes';
import { Swap, SwapAsset } from './FastspotApi';

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

export interface ParsedSignTransactionRequest extends ParsedBasicRequest {
    sender: Nimiq.Address;
    recipient: Nimiq.Address;
    recipientType: Nimiq.Account.Type;
    recipientLabel?: string;
    value: number;
    fee: number;
    data: Uint8Array;
    flags: number;
    validityStartHeight: number; // FIXME To be made optional when hub has its own network
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
        outputScript: string,
        value: number,
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
}

export interface ParsedAddBtcAddressesRequest extends ParsedSimpleRequest {
    chain: 'internal' | 'external';
    firstIndex: number;
}

/**
 * Swap
 */

export interface ParsedSetupSwapRequest extends ParsedBasicRequest {
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
        }>;
        output: {
            // address: string, // HTLC address
            value: number, // Sats
        };
        changeOutput?: {
            address: string,
            value: number, // Sats
        };
        // htlcScript: Uint8Array,
        refundAddress: string,
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
    };

    // Data needed for display
    fiatCurrency: string;
    nimFiatRate: number;
    btcFiatRate: number;
    serviceFundingNetworkFee: number; // Luna or Sats, depending which one gets funded
    serviceRedeemingNetworkFee: number; // Luna or Sats, depending which one gets redeemed
    serviceExchangeFee: number; // Luna or Sats, depending which one gets funded
    nimiqAddresses: Array<{
        address: string,
        balance: number, // Luna
    }>;
    bitcoinAccount: {
        balance: number, // Sats
    };
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
                             | ParsedSetupSwapRequest;
