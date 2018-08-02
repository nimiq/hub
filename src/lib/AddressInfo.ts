export class AddressInfo {
    public static fromObject(o: AddressInfoEntry): AddressInfo {
        return new AddressInfo(o.path, o.label, Nimiq.Address.unserialize(new Nimiq.SerialBuffer(o.address)));
    }

    public constructor(public path: string, public label: string, public address: Nimiq.Address) {}

    public get userFriendlyAddress(): string {
        return this.address.toUserFriendlyAddress();
    }

    public toObject(): AddressInfoEntry {
        return {
            path: this.path,
            label: this.label,
            address: this.address.serialize(),
        };
    }
}

/*
 * Database Types
 */
export interface AddressInfoEntry {
    path: string;
    label: string;
    address: Uint8Array;
}
