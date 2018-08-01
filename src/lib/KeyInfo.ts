enum KeyStorageType {
    LEGACY,
    BIP39,
    LEDGER,
}
enum ContractType {
    VESTING,
    HTLC,
}

class KeyInfo {
    public static fromObject(o: DBKeyInfo): KeyInfo {
        const addresses = new Map();
        o.addresses.forEach((address, path) => {
            addresses.set(path, AddressInfo.fromObject(address));
        });
        return new KeyInfo(o.id, o.label, addresses, o.contracts, o.type);
    }

    public constructor(public id: string, public label: string, public addresses: Map</*path*/ string, AddressInfo>,
                       public contracts: Map</*id*/ string, ContractInfo>, public type: KeyStorageType) {}

    public toObject(): DBKeyInfo {
        const addresses = new Map();
        this.addresses.forEach((address, path) => {
            addresses.set(path, address.toObject());
        });
        return {
            id: this.id,
            label: this.label,
            addresses,
            contracts: this.contracts,
            type: this.type,
        };
    }
}

interface ContractInfo {
    id: string;
    label: string;
    ownerPath: string;
    type: ContractType;
}

/*
 * Database Types
 */
interface DBKeyInfo {
    id: string;
    label: string;
    addresses: Map</*path*/ string, DBAddressInfo>;
    contracts: Map</*id*/ string, ContractInfo>;
    type: KeyStorageType;
}
