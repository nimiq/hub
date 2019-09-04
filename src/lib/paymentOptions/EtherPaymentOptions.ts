import { CurrencyCodeRecord } from 'currency-codes';
import bigInt from 'big-integer';
import { Currency, PaymentMethod, PaymentOptions } from '../PublicRequestTypes';
import { ParsedPaymentOptions } from '../RequestTypes';

export interface EtherDirectPaymentOptions  extends PaymentOptions<Currency.ETH, PaymentMethod.DIRECT> {
    protocolSpecific: {
        gasLimit?: number;
        gasPrice?: string;
        recipient?: string;
    };
}

export class ParsedEtherDirectPaymentOptions extends ParsedPaymentOptions<Currency.ETH, PaymentMethod.DIRECT> {
    public readonly digits: number = 18;
    public readonly minDigits: number = 1;
    public readonly maxDigits: number = 3;
    public readonly currency: Currency.ETH = Currency.ETH;
    public readonly type: PaymentMethod.DIRECT = PaymentMethod.DIRECT;
    public amount: bigInt.BigInteger;
    public protocolSpecific: {
        gasLimit?: number;
        gasPrice?: bigInt.BigInteger;
        recipient?: string;
    };

    public get total(): bigInt.BigInteger {
        return this.amount.add(this.fee);
    }

    public get fee(): bigInt.BigInteger {
        return this.protocolSpecific.gasPrice!.times(this.protocolSpecific.gasLimit!) || bigInt(0);
    }

    public get paymentLink() {
        return ''; // TODO
    }

    public constructor(option: EtherDirectPaymentOptions) {
        super(option);
        this.amount = bigInt(option.amount);
        this.protocolSpecific = {
            gasLimit: option.protocolSpecific.gasLimit,
            gasPrice: option.protocolSpecific.gasPrice
                ? bigInt(option.protocolSpecific.gasPrice)
                : undefined,
            recipient: option.protocolSpecific.recipient,
        };
    }

    public update(options: EtherDirectPaymentOptions) {
        const newOptions = new ParsedEtherDirectPaymentOptions(options);
        this.expires = newOptions.expires || this.expires;
        this.amount = newOptions.amount || this.amount;
        this.protocolSpecific = {
            gasLimit: newOptions.protocolSpecific.gasLimit || this.protocolSpecific.gasLimit,
            gasPrice: newOptions.protocolSpecific.gasPrice || this.protocolSpecific.gasPrice,
            recipient: newOptions.protocolSpecific.recipient || this.protocolSpecific.recipient,
        };
    }

    public fiatFee(fiatAmount: number, fiatCurrency: CurrencyCodeRecord): number {
        if (!this.amount || !fiatAmount || !fiatCurrency) {
            throw new Error('amount, fiatAmount and fiatCurrency must be provided');
        }

        if (this.fee.isZero()) {
            return 0;
        }

        return this.fee
            .times(bigInt(fiatAmount * (10 ** fiatCurrency.digits)))
            .divide(this.amount) // integer division loss of precision here.
            .valueOf() / (10 ** fiatCurrency.digits);
    }

    public raw(): EtherDirectPaymentOptions {
        return {
            currency: this.currency,
            type: this.type,
            expires: this.expires,
            amount: this.amount.toString(),
            protocolSpecific: {
                gasLimit: this.protocolSpecific.gasLimit,
                gasPrice: this.protocolSpecific.gasPrice
                    ? this.protocolSpecific.gasPrice.toString()
                    : undefined,
                recipient: this.protocolSpecific.recipient,
            },
        };
    }
}
