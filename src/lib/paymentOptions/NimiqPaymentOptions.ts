import { CurrencyCodeRecord } from 'currency-codes';
import { TX_VALIDITY_WINDOW, TX_MIN_VALIDITY_DURATION } from '../Constants';
import { Currency, PaymentMethod, PaymentOptions } from '../PublicRequestTypes';
import { Omit, ParsedPaymentOptions } from '../RequestTypes';
import { createNimiqRequestLink, toNonScientificNumberString } from '@nimiq/utils';

export interface NimiqDirectPaymentOptions extends PaymentOptions<Currency.NIM, PaymentMethod.DIRECT> {
    protocolSpecific: {
        fee?: number | string;
        feePerByte?: number | string;
        validityDuration?: number;
        sender?: string;
        forceSender?: boolean;
        recipient?: string;
        recipientType?: Nimiq.Account.Type;
    };
}

export type ExtendedNimiqDirectPaymentOptions = Omit<NimiqDirectPaymentOptions, 'protocolSpecific'> & {
    protocolSpecific: {
        fee?: number | string;
        feePerByte?: number | string;
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
        forceSender: boolean,
        fee: number,
        feePerByte: number;
        flags: number,
        recipient?: Nimiq.Address,
        recipientType?: Nimiq.Account.Type,
        validityDuration: number,
    };

    private extraData: Uint8Array;

    public get paymentLink() {
        if (!this.protocolSpecific.recipient) return '#';
        return createNimiqRequestLink(this.protocolSpecific.recipient.toUserFriendlyAddress(false), {
            amount: this.amount,
            basePath: 'safe.nimiq.com',
        });
    }

    public constructor(option: NimiqDirectPaymentOptions | ExtendedNimiqDirectPaymentOptions, extraData: Uint8Array) {
        super(option);
        this.extraData = extraData;
        this.amount = Number.parseInt(toNonScientificNumberString(option.amount), 10);

        let sender: Nimiq.Address | undefined;
        if (option.protocolSpecific.sender !== undefined) {
            try {
                sender = Nimiq.Address.fromUserFriendlyAddress(option.protocolSpecific.sender);
            } catch (err) {
                throw new Error('If provided, sender must be a valid user friendly address string');
            }
        }

        let recipient: Nimiq.Address | undefined;
        if (option.protocolSpecific.recipient !== undefined) {
            try {
                recipient = Nimiq.Address.fromUserFriendlyAddress(option.protocolSpecific.recipient);
            } catch (err) {
                throw new Error('If provided, recipient must be a valid user friendly address string');
            }
        }

        let recipientType: Nimiq.Account.Type | undefined;
        if (option.protocolSpecific.recipientType !== undefined) {
            if (!Object.values(Nimiq.Account.Type).includes(option.protocolSpecific.recipientType)) {
                throw new Error('If provided, recipientType must be a valid nimiq account type');
            }
            recipientType = option.protocolSpecific.recipientType;
        }

        const flags = (option as ExtendedNimiqDirectPaymentOptions).protocolSpecific.flags;
        if (flags !== undefined && typeof flags !== 'number') {
            throw new Error('If provided, flags must be a number.');
        }

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

        const requiresExtendedTransaction = extraData.length > 0
            || recipientType !== undefined && recipientType !== Nimiq.Account.Type.BASIC
            || flags !== undefined && flags !== Nimiq.Transaction.Flag.NONE;
        // Note that the transaction size can be bigger than this, for example if the sender type the user wants to use
        // requires an extended transaction or if an extended transaction includes a multi signature proof. The size
        // is therefore just an estimate. In the majority of cases the estimate will be accurate though and a fee that
        // is slightly off will generally not be a problem.
        const estimatedTransactionSize = requiresExtendedTransaction ? 166 + extraData.length : 138;

        if (fee === undefined) {
            if (feePerByte === undefined) {
                feePerByte = 0;
                fee = 0;
            } else {
                fee = Math.ceil(feePerByte * estimatedTransactionSize);
            }
        } else {
            feePerByte = fee / estimatedTransactionSize;
        }

        if (option.protocolSpecific.validityDuration !== undefined
            && !this.isNonNegativeInteger(option.protocolSpecific.validityDuration)) {
            throw new Error('If provided, validityDuration must be a non-negative integer.');
        }

        this.protocolSpecific = {
            sender,
            forceSender: !!option.protocolSpecific.forceSender,
            fee,
            feePerByte,
            flags: flags || Nimiq.Transaction.Flag.NONE,
            recipient,
            recipientType,
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
        const newOptions = new ParsedNimiqDirectPaymentOptions(options, this.extraData);
        this.expires = newOptions.expires || this.expires;
        this.amount = newOptions.amount || this.amount;
        this.protocolSpecific = {
            sender: newOptions.protocolSpecific.sender || this.protocolSpecific.sender,
            forceSender: newOptions.protocolSpecific.forceSender || this.protocolSpecific.forceSender,
            fee: newOptions.protocolSpecific.fee || this.protocolSpecific.fee,
            feePerByte: newOptions.protocolSpecific.feePerByte || this.protocolSpecific.feePerByte,
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
        return this.protocolSpecific.fee;
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
                feePerByte: this.protocolSpecific.feePerByte,
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
