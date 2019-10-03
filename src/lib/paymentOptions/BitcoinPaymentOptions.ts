import { Currency, PaymentMethod, PaymentOptions } from '../PublicRequestTypes';
import { ParsedPaymentOptions } from '../RequestTypes';
import { toNonScientificNumberString } from '@nimiq/utils';

export interface BitcoinDirectPaymentOptions extends PaymentOptions<Currency.BTC, PaymentMethod.DIRECT> {
    protocolSpecific: {
        fee?: number | string;
        recipient?: string;
    };
}

export class ParsedBitcoinDirectPaymentOptions extends ParsedPaymentOptions<Currency.BTC, PaymentMethod.DIRECT> {
    public readonly decimals: number = 8;
    public readonly minDecimals: number = 3;
    public readonly maxDecimals: number = 5;
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

    public constructor(option: BitcoinDirectPaymentOptions) {
        super(option);
        this.amount = Number.parseInt(toNonScientificNumberString(option.amount), 10);

        let fee: number | undefined;
        if (option.protocolSpecific.fee !== undefined) {
            if (!this.isNonNegativeInteger(option.protocolSpecific.fee)) {
                throw new Error('If provided, fee must be a non-negative integer');
            }
            fee = Number.parseInt(toNonScientificNumberString(option.protocolSpecific.fee), 10);
        }

        if (option.protocolSpecific.recipient && typeof option.protocolSpecific.recipient !== 'string') {
            // TODO add btc address validation here?
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

    public fiatFee(fiatAmount: number): number {
        if (!this.amount || !fiatAmount) {
            throw new Error('amount and fiatAmount must be provided');
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
