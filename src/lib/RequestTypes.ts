type BigInteger = import('big-integer').BigInteger; // imports only the type without bundling
import { FormattableNumber, toNonScientificNumberString } from '@nimiq/utils';
import { isMilliseconds } from './Constants';
import { Currency, PaymentMethod, PaymentOptionsForCurrencyAndType, RequestType } from './PublicRequestTypes';
import { ParsedNimiqSpecifics, ParsedNimiqDirectPaymentOptions } from './paymentOptions/NimiqPaymentOptions';
import { ParsedEtherSpecifics, ParsedEtherDirectPaymentOptions } from './paymentOptions/EtherPaymentOptions';
import { ParsedBitcoinSpecifics, ParsedBitcoinDirectPaymentOptions } from './paymentOptions/BitcoinPaymentOptions';

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

export type ParsedProtocolSpecificsForCurrency<C extends Currency> =
    C extends Currency.NIM ? ParsedNimiqSpecifics
    : C extends Currency.BTC ? ParsedBitcoinSpecifics
    : C extends Currency.ETH ? ParsedEtherSpecifics
    : undefined;

export interface ParsedPaymentOptions<C extends Currency, T extends PaymentMethod> {
    readonly currency: C;
    readonly type: T;
    readonly decimals: number;
    protocolSpecific: ParsedProtocolSpecificsForCurrency<C>;
    amount: number | BigInteger;
    expires?: number;
    constructor: ParsedPaymentOptionsForCurrencyAndType<C, T>;
    new(options: PaymentOptionsForCurrencyAndType<C, T>, ...optionalArgs: any[]):
        ParsedPaymentOptionsForCurrencyAndType<C, T>;
    raw(): PaymentOptionsForCurrencyAndType<C, T>;
}

export abstract class ParsedPaymentOptions<C extends Currency, T extends PaymentMethod>
    implements ParsedPaymentOptions<C, T> {

    protected constructor(options: PaymentOptionsForCurrencyAndType<C, T>) {
        if (options.currency !== this.currency || options.type !== this.type) {
            throw new Error(`Can't parse given options as ${this.constructor.name}.`);
        }
        if (!this.isNonNegativeInteger(options.amount)) {
            throw new Error('amount must be a non-negative integer');
        }
        this.expires = typeof options.expires === 'number'
            ? isMilliseconds(options.expires)
                ? options.expires
                : options.expires * 1000
            : undefined;
    }

    public get baseUnitAmount(): string {
        return new FormattableNumber(this.amount).moveDecimalSeparator(-this.decimals).toString();
    }

    public update<P extends ParsedPaymentOptions<C, T>>(
        this: P,
        options: PaymentOptionsForCurrencyAndType<C, T>,
        ...additionalArgs: any[]
    ) {
        const parsedOptions = new this.constructor(options as any, ...additionalArgs); // parse to check validity
        this.amount = parsedOptions.amount; // amount must exist on all parsed options
        this.expires = parsedOptions.expires !== undefined ? parsedOptions.expires : this.expires;
        for (const key of
            Object.keys(parsedOptions.protocolSpecific) as Array<keyof typeof parsedOptions.protocolSpecific>) {
            if (parsedOptions.protocolSpecific[key] === undefined) continue;
            this.protocolSpecific[key] = parsedOptions.protocolSpecific[key];
        }
    }

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
    fiatCurrency?: string;
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
