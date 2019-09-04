import CurrencyCode from 'currency-codes';
import {
    RequestType,
    PaymentOptions,
    Currency,
    PaymentMethod,
    MultiCurrencyCheckoutRequest,
    AvailablePaymentOptions,
} from './PublicRequestTypes';
import {
    ParsedNimiqDirectPaymentOptions,
    ExtendedNimiqDirectPaymentOptions,
    NimiqDirectPaymentOptions,
 } from './paymentOptions/NimiqPaymentOptions';
import {
    ParsedEtherDirectPaymentOptions,
    EtherDirectPaymentOptions,
} from './paymentOptions/EtherPaymentOptions';
import {
    ParsedBitcoinDirectPaymentOptions,
    BitcoinDirectPaymentOptions,
} from './paymentOptions/BitcoinPaymentOptions';

export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

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
    value: number;
    fee: number;
    data: Uint8Array;
    flags: number;
    validityStartHeight: number; // FIXME To be made optional when hub has its own network
}

export interface ParsedPaymentOptions<C extends Currency, T extends PaymentMethod> {
    currency: C;
    type: T;
    expires: number;
    paymentLink: string;
    raw(): PaymentOptions<C, T>;
}

export abstract class ParsedPaymentOptions<C extends Currency, T extends PaymentMethod>
    implements ParsedPaymentOptions<C, T> {
    public readonly abstract digits: number;
    public readonly abstract minDigits: number;
    public readonly abstract maxDigits: number;
    public expires: number;

    public constructor(option: PaymentOptions<C, T>) {
        this.expires = option.expires;
    }

    public abstract update(option: PaymentOptions<C, T>): void;
}

export type AvailableParsedPaymentOptions = ParsedNimiqDirectPaymentOptions
                                   | ParsedEtherDirectPaymentOptions
                                   | ParsedBitcoinDirectPaymentOptions;

export interface ParsedCheckoutRequest extends ParsedBasicRequest {
    shopLogoUrl?: string;
    callbackUrl?: string;
    data: Uint8Array;
    time: number;
    fiatCurrency?: CurrencyCode.CurrencyCodeRecord;
    fiatAmount?: number;
    paymentOptions: AvailableParsedPaymentOptions[];
}

export type ExtendedPaymentOptions = ExtendedNimiqDirectPaymentOptions
                                   | EtherDirectPaymentOptions
                                   | BitcoinDirectPaymentOptions;

export type ExtendedCheckoutRequest = Omit<MultiCurrencyCheckoutRequest,
    'paymentOptions' | 'fiatCurrency' | 'fiatAmount'> & {
    fiatCurrency?: CurrencyCode.CurrencyCodeRecord;
    fiatAmount?: number;
    paymentOptions: ExtendedPaymentOptions[];
};

export type ExtendedRpcRequest = ExtendedCheckoutRequest;

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

// Discriminated Unions
export type ParsedRpcRequest = ParsedSignTransactionRequest
                             | ParsedCheckoutRequest
                             | ParsedBasicRequest
                             | ParsedSimpleRequest
                             | ParsedOnboardRequest
                             | ParsedRenameRequest
                             | ParsedSignMessageRequest
                             | ParsedExportRequest;
