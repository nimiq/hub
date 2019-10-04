import { CurrencyCodeRecord } from 'currency-codes';
import { Currency, PaymentMethod, PaymentOptions } from '../PublicRequestTypes';
import { ParsedPaymentOptions } from '../RequestTypes';
import { createBitcoinRequestLink, toNonScientificNumberString } from '@nimiq/utils';
import staticStore from '../StaticStore';

export interface BitcoinDirectPaymentOptions extends PaymentOptions<Currency.BTC, PaymentMethod.DIRECT> {
    protocolSpecific: {
        fee?: number | string;
        feePerByte?: number | string;
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
        feePerByte?: number;
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
        this.amount = Number.parseInt(toNonScientificNumberString(option.amount), 10);

        let feePerByte: number | undefined;
        if (option.protocolSpecific.feePerByte !== undefined) {
            try {
                feePerByte = parseFloat(toNonScientificNumberString(option.protocolSpecific.feePerByte));
            } catch (e) {
                throw new Error('If provided, feePerByte must be a valid number');
            }
        }

        let fee: number | undefined;
        if (option.protocolSpecific.fee !== undefined) {
            if (!this.isNonNegativeInteger(option.protocolSpecific.fee)) {
                throw new Error('If provided, fee must be a non-negative integer');
            }
            fee = Number.parseInt(toNonScientificNumberString(option.protocolSpecific.fee), 10);
        }

        if (feePerByte === undefined && fee !== undefined) {
            throw new Error('If fee is provided, feePerByte must be provided too. The reasoning behind this is that ' +
                'the actual transaction speed depends on feePerByte rather than on fee. Therefore the feePerByte' +
                'that the fee was calculated from should be provided.');
        } else if (feePerByte !== undefined && fee === undefined) {
            // estimate the fee from feePerByte
            fee = feePerByte * 250; // 250 is the estimated size for a standard tx with two inputs and one output
        }

        if (option.protocolSpecific.recipient && typeof option.protocolSpecific.recipient !== 'string') {
            // TODO add btc address validation here?
            throw new Error('If a recipient is provided it must be a string');
        }

        this.protocolSpecific = {
            fee,
            feePerByte,
            recipient: option.protocolSpecific.recipient,
        };
    }

    public update(options: BitcoinDirectPaymentOptions) {
        const newOptions = new ParsedBitcoinDirectPaymentOptions(options);
        this.expires = newOptions.expires || this.expires;
        this.amount = newOptions.amount || this.amount;
        this.protocolSpecific = {
            fee: newOptions.fee || this.protocolSpecific.fee,
            feePerByte: newOptions.protocolSpecific.feePerByte || this.protocolSpecific.feePerByte,
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
                feePerByte: this.protocolSpecific.feePerByte,
                recipient: this.protocolSpecific.recipient,
            },
        };
    }
}
