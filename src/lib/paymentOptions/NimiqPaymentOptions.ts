import { CurrencyCodeRecord } from 'currency-codes';
import { TX_VALIDITY_WINDOW, TX_MIN_VALIDITY_DURATION } from '../Constants';
import { Currency, PaymentMethod, PaymentOptions } from '../PublicRequestTypes';
import { Omit, ParsedPaymentOptions } from '../RequestTypes';
import { createNimiqRequestLink } from '@nimiq/utils';

export interface NimiqDirectPaymentOptions extends PaymentOptions<Currency.NIM, PaymentMethod.DIRECT> {
    protocolSpecific: {
        fee?: number;
        validityDuration?: number;
        sender?: string;
        forceSender?: boolean;
        recipient?: string;
        recipientType?: Nimiq.Account.Type;
    };
}

export type ExtendedNimiqDirectPaymentOptions = Omit<NimiqDirectPaymentOptions, 'protocolSpecific'> & {
    protocolSpecific: {
        fee?: number;
        validityDuration?: number;
        flags: number;
        recipient?: string;
        recipientType?: Nimiq.Account.Type;
        sender?: string;
        forceSender: boolean;
    };
};

export class ParsedNimiqDirectPaymentOptions extends ParsedPaymentOptions<Currency.NIM, PaymentMethod.DIRECT> {
    public readonly digits: number = 5;
    public readonly minDigits: number = 0;
    public readonly maxDigits: number = 0;
    public readonly currency: Currency.NIM = Currency.NIM;
    public readonly type: PaymentMethod.DIRECT = PaymentMethod.DIRECT;

    public amount: number;
    public protocolSpecific: {
        sender?: Nimiq.Address,
        forceSender?: boolean,
        fee?: number,
        flags: number,
        recipient?: Nimiq.Address,
        recipientType?: Nimiq.Account.Type,
        validityDuration?: number,
    };

    public get paymentLink() {
        if (!this.protocolSpecific.recipient) return '#';
        return createNimiqRequestLink(this.protocolSpecific.recipient.toUserFriendlyAddress(false), {
            amount: this.amount,
            basePath: 'safe.nimiq.com',
        });
    }

    public constructor(option: NimiqDirectPaymentOptions | ExtendedNimiqDirectPaymentOptions) {
        super(option);
        this.amount = parseInt(option.amount, 10);
        this.protocolSpecific = {
            sender: option.protocolSpecific.sender
                ? Nimiq.Address.fromUserFriendlyAddress(
                    option.protocolSpecific.sender)
                : undefined,
            forceSender: !!option.protocolSpecific.forceSender,
            fee: option.protocolSpecific.fee,
            flags: (option as ExtendedNimiqDirectPaymentOptions)
                .protocolSpecific.flags || Nimiq.Transaction.Flag.NONE,
            recipient: option.protocolSpecific.recipient
                ? Nimiq.Address.fromUserFriendlyAddress(
                    option.protocolSpecific.recipient)
                : undefined,
            recipientType: option.protocolSpecific.recipientType,
            validityDuration: !option.protocolSpecific.validityDuration
                ? TX_VALIDITY_WINDOW
                : Math.min(
                    TX_VALIDITY_WINDOW,
                    Math.max(
                        TX_MIN_VALIDITY_DURATION,
                        option.protocolSpecific.validityDuration,
                    ),
                ),
        };
    }

    public update(options: NimiqDirectPaymentOptions) {
        const newOptions = new ParsedNimiqDirectPaymentOptions(options);
        this.expires = newOptions.expires || this.expires;
        this.amount = newOptions.amount || this.amount;
        this.protocolSpecific = {
            sender: newOptions.protocolSpecific.sender || this.protocolSpecific.sender,
            forceSender: newOptions.protocolSpecific.forceSender || this.protocolSpecific.forceSender,
            fee: newOptions.protocolSpecific.fee || this.protocolSpecific.fee,
            flags: newOptions.protocolSpecific.flags || this.protocolSpecific.flags,
            recipient: newOptions.protocolSpecific.recipient || this.protocolSpecific.recipient,
            recipientType: newOptions.protocolSpecific.recipientType || this.protocolSpecific.recipientType,
            validityDuration: newOptions.protocolSpecific.validityDuration || this.protocolSpecific.validityDuration,
        };
    }

    public get total(): number {
        return this.amount + this.fee;
    }

    public get fee(): number {
        return this.protocolSpecific.fee || 0;
    }

    public fiatFee(fiatAmount: number, fiatCurrency: CurrencyCodeRecord): number {
        if (!this.amount || !fiatAmount || !fiatCurrency) {
            throw new Error('amount, fiatAmount and fiatCurrency must be provided');
            return 0;
        }
        if (!this.fee) {
            return 0;
        }
        return this.fee * fiatAmount / this.amount;
    }

    public raw(): ExtendedNimiqDirectPaymentOptions {
        return {
            currency: this.currency,
            type: this.type,
            expires: this.expires,
            amount: this.amount.toString(),
            protocolSpecific: {
                recipient: this.protocolSpecific.recipient
                    ? this.protocolSpecific.recipient.toUserFriendlyAddress()
                    : undefined,
                fee: this.protocolSpecific.fee,
                validityDuration: this.protocolSpecific.validityDuration,
                sender: this.protocolSpecific.sender
                    ? this.protocolSpecific.sender.toUserFriendlyAddress()
                    : undefined,
                flags: this.protocolSpecific.flags,
                recipientType: this.protocolSpecific.recipientType,
                forceSender: !!this.protocolSpecific.forceSender,
            },
        };
    }
}
