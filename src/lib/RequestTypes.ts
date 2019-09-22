type BigInteger = import('big-integer').BigInteger; // imports only the type without bundling
import CurrencyCode from 'currency-codes';
import { isMilliseconds } from './Constants';
import { FormattableNumber, toNonScientificNumberString } from '@nimiq/utils';
import {
    RequestType,
    PaymentOptions,
    Currency,
    PaymentMethod,
} from './PublicRequestTypes';
import { ParsedNimiqDirectPaymentOptions } from './paymentOptions/NimiqPaymentOptions';
import { ParsedEtherDirectPaymentOptions } from './paymentOptions/EtherPaymentOptions';
import { ParsedBitcoinDirectPaymentOptions } from './paymentOptions/BitcoinPaymentOptions';

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
    readonly currency: C;
    readonly type: T;
    expires?: number;
    paymentLink: string;
    raw(): PaymentOptions<C, T>;
}

export abstract class ParsedPaymentOptions<C extends Currency, T extends PaymentMethod>
    implements ParsedPaymentOptions<C, T> {
    public abstract amount: number | BigInteger;
    public readonly abstract digits: number;
    public readonly abstract minDigits: number;
    public readonly abstract maxDigits: number;
    public expires?: number;

    public constructor(option: PaymentOptions<C, T>) {
        if (!this.isNonNegativeInteger(option.amount)) {
            throw new Error('amount must be a non-negative integer');
        }
        this.expires = typeof option.expires === 'number'
            ? isMilliseconds(option.expires)
                ? option.expires
                : option.expires * 1000
            : undefined;
    }

    public get baseUnitAmount(): string {
        return new FormattableNumber(this.amount).moveDecimalSeparator(-this.digits).toString();
    }

    public abstract update(options: PaymentOptions<C, T>): void;

    protected isNonNegativeInteger(value: string | number | bigint | BigInteger) {
        try {
            return /^\d+$/.test(toNonScientificNumberString(value));
        } catch (e) {
            return false;
        }
    }
}

export type AvailableParsedPaymentOptions = ParsedNimiqDirectPaymentOptions
                                   | ParsedEtherDirectPaymentOptions
                                   | ParsedBitcoinDirectPaymentOptions;

export type ParsedPaymentOptionsForCurrencyAndType<C extends Currency, T extends PaymentMethod> =
    T extends PaymentMethod.DIRECT ?
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
    data: Uint8Array;
    time: number;
    fiatCurrency?: CurrencyCode.CurrencyCodeRecord;
    fiatAmount?: number;
    paymentOptions: AvailableParsedPaymentOptions[];
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

// Discriminated Unions
export type ParsedRpcRequest = ParsedSignTransactionRequest
                             | ParsedCheckoutRequest
                             | ParsedBasicRequest
                             | ParsedSimpleRequest
                             | ParsedOnboardRequest
                             | ParsedRenameRequest
                             | ParsedSignMessageRequest
                             | ParsedExportRequest;
