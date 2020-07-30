export class BtcAddressInfo {
    public static fromObject(o: BtcAddressInfoEntry): BtcAddressInfo {
        return new BtcAddressInfo(
            o.path,
            o.address,
            o.used,
            o.balance,
        );
    }

    public static objectToBtcAddressType(o: BtcAddressInfoEntry): string {
        return o.address;
    }

    public walletId?: string;

    public constructor(
        public path: string,
        public address: string,
        public used: boolean,
        public balance?: number,
    ) {}

    public toObject(): BtcAddressInfoEntry {
        return {
            path: this.path,
            address: this.address,
            used: this.used,
            balance: this.balance,
        };
    }

    public toBtcAddressType(): string {
        return this.address;
    }
}

/*
 * Database Types
 */
export interface BtcAddressInfoEntry {
    path: string;
    address: string;
    used: boolean;
    balance?: number;
}
