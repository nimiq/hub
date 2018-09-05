import {AddressInfo, AddressInfoEntry} from '@/lib/AddressInfo';
import {ContractInfo} from '@/lib/ContractInfo';

export enum KeyStorageType {
    LEGACY,
    BIP39,
    LEDGER,
}

export class KeyInfo {
    public static fromObject(o: KeyInfoEntry): KeyInfo {
        const addresses = new Map();
        o.addresses.forEach((address, path) => {
            addresses.set(path, AddressInfo.fromObject(address));
        });
        return new KeyInfo(o.id, o.label, addresses, o.contracts, o.type);
    }

    public constructor(public id: string,
                       public label: string,
                       public addresses: Map</*path*/ string, AddressInfo>,
                       public contracts: ContractInfo[],
                       public type: KeyStorageType) {}

    public toObject(): KeyInfoEntry {
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

/*
 * Database Types
 */
export interface KeyInfoEntry {
    id: string;
    label: string;
    addresses: Map</*path*/ string, AddressInfoEntry>;
    contracts: ContractInfo[];
    type: KeyStorageType;
}
