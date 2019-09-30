import { CurrencyCodeRecord } from 'currency-codes';
import bigInt from 'big-integer';
import { Currency, PaymentMethod, PaymentOptions } from '../PublicRequestTypes';
import { ParsedPaymentOptions } from '../RequestTypes';
import { createEthereumRequestLink } from '@nimiq/utils';

export interface EtherDirectPaymentOptions  extends PaymentOptions<Currency.ETH, PaymentMethod.DIRECT> {
    protocolSpecific: {
        gasLimit?: number | string;
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
        if (!this.protocolSpecific.recipient) return '#';
        return createEthereumRequestLink(this.protocolSpecific.recipient, {
            amount: this.amount,
            gasLimit: this.protocolSpecific.gasLimit,
            gasPrice: this.protocolSpecific.gasPrice,
        });
    }

    public constructor(option: EtherDirectPaymentOptions) {
        super(option);
        if (!option.amount) {
            throw new Error('Each paymentOption must provide an amount.');
        } else {
            try {
                this.amount = bigInt(option.amount);
            } catch (err) {
                throw new Error('The provided amount must parse as an integer');
            }
        }

        let gasLimit: number | undefined;
        if (option.protocolSpecific.gasLimit) {
            if (typeof option.protocolSpecific.gasLimit === 'string') {
                try {
                    gasLimit = Number.parseInt(option.protocolSpecific.gasLimit, 10);
                } catch (err) {
                    throw new Error('The provided gasLimit must parse as an integer');
                }
            } else if (typeof option.protocolSpecific.gasLimit === 'number') {
                gasLimit = option.protocolSpecific.gasLimit;
            } else {
                throw new Error('If a gasLimit is provided it must either be of type string or number');
            }
        }

        let gasPrice: bigInt.BigInteger | undefined;
        if (option.protocolSpecific.gasPrice) {
            if (typeof option.protocolSpecific.gasPrice !== 'string') {
                throw new Error('If a gasPrice is provided it must be of type string');
            } else {
                try {
                    gasPrice = bigInt(option.protocolSpecific.gasPrice);
                } catch (err) {
                    throw new Error('The provided gasPrice must parse as an integer');
                }
            }
        }

        if (option.protocolSpecific.recipient && typeof option.protocolSpecific.recipient !== 'string') {
            // add eth address validation here.
            throw new Error('If a recipient is provided it must be of type string');
        }

        this.protocolSpecific = {
            gasLimit,
            gasPrice,
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
            .times(bigInt(Math.round(fiatAmount * (10 ** fiatCurrency.digits))))
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
