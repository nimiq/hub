type BigInteger = import('big-integer').BigInteger; // imports only the type without bundling
import { FormattableNumber, toNonScientificNumberString } from '@nimiq/utils';
import { isMilliseconds } from './Constants';
import {
    RequestType,
    Currency,
    PaymentMethod,
    PaymentOptionsForCurrencyAndType,
} from './PublicRequestTypes';
import {
    ParsedNimiqProtocolSpecific,
    ParsedNimiqDirectPaymentOptions,
} from './paymentOptions/NimiqPaymentOptions';
import {
    ParsedEtherProtocolSpecific,
    ParsedEtherDirectPaymentOptions,
} from './paymentOptions/EtherPaymentOptions';
import {
    ParsedBitcoinProtocolSpecific,
    ParsedBitcoinDirectPaymentOptions,
} from './paymentOptions/BitcoinPaymentOptions';

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

export type ParsedProtocolSpecificForCurrency<C extends Currency> =
    C extends Currency.NIM ? ParsedNimiqProtocolSpecific
    : C extends Currency.BTC ? ParsedBitcoinProtocolSpecific
    : C extends Currency.ETH ? ParsedEtherProtocolSpecific
    : {} | undefined;

export interface ParsedPaymentOptions<C extends Currency, T extends PaymentMethod> {
    readonly currency: C;
    readonly type: T;
    readonly decimals: number;
    protocolSpecific: ParsedProtocolSpecificForCurrency<C>;
    amount: number | BigInteger;
    expires?: number;
    constructor: ParsedPaymentOptionsForCurrencyAndType<C, T>;
    new(options: PaymentOptionsForCurrencyAndType<C, T>, ...optionalArgs: any[]):
        ParsedPaymentOptionsForCurrencyAndType<C, T>;
    raw(): PaymentOptionsForCurrencyAndType<C, T>;
}

export abstract class ParsedPaymentOptions<C extends Currency, T extends PaymentMethod>
    implements ParsedPaymentOptions<C, T> {

    protected constructor(option: PaymentOptionsForCurrencyAndType<C, T>) {
        if (option.currency !== this.currency || option.type !== this.type) {
            throw new Error(`Can't parse given options as ${this.constructor.name}.`);
        }
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

    public update<P extends ParsedPaymentOptions<C, T>>(
        this: P,
        option: PaymentOptionsForCurrencyAndType<C, T>,
        ...additionalArgs: any[]
    ) {
        const parsedOptions = new this.constructor(option as any, ...additionalArgs); // parse to check validity
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
