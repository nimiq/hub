import { Address } from './PublicRequestTypes';

export class AccountInfo {
    public static fromObject(o: AccountInfoEntry): AccountInfo {
        return new AccountInfo(
            o.path,
            o.label,
            new Nimiq.Address(o.address),
            o.balance,
        );
    }

    public walletId?: string;

    public constructor(
        public path: string,
        public label: string,
        public address: Nimiq.Address,
        public balance?: number,
    ) {}

    public get userFriendlyAddress(): string {
        return this.address.toUserFriendlyAddress();
    }

    public toObject(): AccountInfoEntry {
        return {
            path: this.path,
            label: this.label,
            address: new Uint8Array(this.address.serialize()),
            balance: this.balance,
        };
    }

    public toAddressType(): Address {
        return {
            address: this.userFriendlyAddress,
            label: this.label,
        };
    }
}

/*
 * Database Types
 */
export interface AccountInfoEntry {
    path: string;
    label: string;
    address: Uint8Array;
    balance?: number;
}
