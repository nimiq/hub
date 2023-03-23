import { PaymentOptions, Currency, PaymentType } from './PublicRequestTypes';
export interface NimiqSpecifics {
    fee?: number | string;
    feePerByte?: number | string;
    extraData?: Uint8Array | string;
    validityDuration?: number;
    flags?: number;
    sender?: string;
    forceSender?: boolean;
    recipient?: string;
    recipientType?: Nimiq.Account.Type;
}
export declare type NimiqDirectPaymentOptions = PaymentOptions<Currency.NIM, PaymentType.DIRECT>;
export interface BitcoinSpecifics {
    fee?: number | string;
    feePerByte?: number | string;
    recipient?: string;
}
export declare type BitcoinDirectPaymentOptions = PaymentOptions<Currency.BTC, PaymentType.DIRECT>;
export interface EtherSpecifics {
    gasLimit?: number | string;
    gasPrice?: string;
    recipient?: string;
}
export declare type EtherDirectPaymentOptions = PaymentOptions<Currency.ETH, PaymentType.DIRECT>;
