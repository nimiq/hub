export class AccountInfo {
    public static fromObject(o: AccountInfoEntry): AccountInfo {
        return new AccountInfo(
            o.path,
            o.label,
            new Nimiq.Address(new Nimiq.SerialBuffer(o.address)),
            o.balance,
        );
    }

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
