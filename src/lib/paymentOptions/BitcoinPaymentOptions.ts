import { CurrencyCodeRecord } from 'currency-codes';
import { Currency, PaymentMethod, PaymentOptions } from '../PublicRequestTypes';
import { ParsedPaymentOptions } from '../RequestTypes';
import { createBitcoinRequestLink } from '@nimiq/utils';
import staticStore from '../StaticStore';

export interface BitcoinDirectPaymentOptions extends PaymentOptions<Currency.BTC, PaymentMethod.DIRECT> {
    protocolSpecific: {
        fee?: number | string;
        recipient?: string;
    };
}

export class ParsedBitcoinDirectPaymentOptions extends ParsedPaymentOptions<Currency.BTC, PaymentMethod.DIRECT> {
    public readonly digits: number = 8;
    public readonly minDigits: number = 3;
    public readonly maxDigits: number = 5;
    public readonly currency: Currency.BTC = Currency.BTC;
    public readonly type: PaymentMethod.DIRECT = PaymentMethod.DIRECT;
    public amount: number;
    public protocolSpecific: {
        fee?: number;
        recipient?: string;
    };

    public get total(): number {
        return (this.amount + this.fee);
    }

    public get fee(): number {
        return this.protocolSpecific.fee || 0;
    }

    public get paymentLink() {
        if (!this.protocolSpecific.recipient) return '#';
        return createBitcoinRequestLink(this.protocolSpecific.recipient, {
            amount: this.amount,
            fee: this.protocolSpecific.fee,
            label: staticStore.request ? `Nimiq Checkout - ${staticStore.request.appName}` : undefined,
        });
    }

    public constructor(option: BitcoinDirectPaymentOptions) {
        super(option);
        if (!option.amount) {
            throw new Error('Each paymentOption must provide an amount.');
        } else {
            try {
                this.amount = Number.parseInt(option.amount, 10);
            } catch (err) {
                throw new Error('The provided amount must parse as an Integer');
            }
        }

        let fee: number | undefined;
        if (option.protocolSpecific.fee) {
            if (typeof option.protocolSpecific.fee === 'string') {
                try {
                    fee = Number.parseInt(option.protocolSpecific.fee, 10);
                } catch (err) {
                    throw new Error('The provided fee must parse as an integer');
                }
            } else if (typeof option.protocolSpecific.fee === 'number') {
                fee = option.protocolSpecific.fee;
            } else {
                throw new Error('If a fee is provided it must either be a number or a string');
            }
        }

        if (option.protocolSpecific.recipient && typeof option.protocolSpecific.recipient !== 'string') {
            // add btc address validation here.
            throw new Error('If a recipient is provided it must be a string');
        }

        this.protocolSpecific = {
            fee,
            recipient: option.protocolSpecific.recipient,
        };
    }

    public update(options: BitcoinDirectPaymentOptions) {
        const newOptions = new ParsedBitcoinDirectPaymentOptions(options);
        this.expires = newOptions.expires || this.expires;
        this.amount = newOptions.amount || this.amount;
        this.protocolSpecific = {
            fee: newOptions.fee || this.protocolSpecific.fee,
            recipient: newOptions.protocolSpecific.recipient || this.protocolSpecific.recipient,
        };
    }

    public fiatFee(fiatAmount: number, fiatCurrency: CurrencyCodeRecord): number {
        if (!this.amount || !fiatAmount || !fiatCurrency) {
            throw new Error('amount, fiatAmount and fiatCurrency must be provided');
        }
        if (!this.fee) {
            return 0;
        }
        return this.fee * fiatAmount / this.amount;
    }

    public raw(): BitcoinDirectPaymentOptions {
        return {
            currency: this.currency,
            type: this.type,
            expires: this.expires,
            amount: this.amount.toString(),
            protocolSpecific: {
                fee: this.protocolSpecific.fee,
                recipient: this.protocolSpecific.recipient,
            },
        };
    }
}
