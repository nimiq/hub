class AddressInfo {
    public static fromObject(o: DBAddressInfo): AddressInfo {
        return new AddressInfo(o.path, o.label, Nimiq.Address.unserialize(new Nimiq.SerialBuffer(o.address)));
    }

    public constructor(public path: string, public label: string, public address: Nimiq.Address) {}

    public get userFriendlyAddress(): string {
        return this.address.toUserFriendlyAddress();
    }

    public toObject(): DBAddressInfo {
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
interface DBAddressInfo {
    path: string;
    label: string;
    address: Uint8Array;
}

