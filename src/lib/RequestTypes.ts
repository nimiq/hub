type BigInteger = import('big-integer').BigInteger; // imports only the type without bundling
import { FormattableNumber, toNonScientificNumberString } from '@nimiq/utils';
import { isMilliseconds } from './Constants';
import {
    RequestType,
    PaymentOptions,
    Currency,
    PaymentMethod,
    MultiCurrencyCheckoutRequest,
} from './PublicRequestTypes';
import {
    ParsedNimiqDirectPaymentOptions,
    ExtendedNimiqDirectPaymentOptions,
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
    readonly currency: C;
    readonly type: T;
    expires?: number;
    raw(): PaymentOptions<C, T>;
}

export abstract class ParsedPaymentOptions<C extends Currency, T extends PaymentMethod>
    implements ParsedPaymentOptions<C, T> {
    public abstract amount: number | BigInteger;
    public readonly abstract decimals: number;
    public readonly abstract minDecimals: number;
    public readonly abstract maxDecimals: number;
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
        return new FormattableNumber(this.amount).moveDecimalSeparator(-this.decimals).toString();
    }

    public abstract update(option: PaymentOptions<C, T>): void;

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

export interface ParsedCheckoutRequest extends ParsedBasicRequest {
    shopLogoUrl?: string;
    callbackUrl?: string;
    csrf?: string;
    data: Uint8Array;
    time: number;
    fiatCurrency?: string;
    fiatAmount?: number;
    paymentOptions: AvailableParsedPaymentOptions[];
}

export type ExtendedPaymentOptions = ExtendedNimiqDirectPaymentOptions
                                   | EtherDirectPaymentOptions
                                   | BitcoinDirectPaymentOptions;

export type ExtendedCheckoutRequest = Omit<MultiCurrencyCheckoutRequest,
    'paymentOptions' | 'fiatCurrency' | 'fiatAmount'> & {
    fiatCurrency?: string;
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
