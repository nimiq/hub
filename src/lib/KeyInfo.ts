import {AddressInfo, AddressInfoEntry} from './AddressInfo';
import {ContractInfo} from './ContractInfo';

export enum KeyStorageType {
    LEGACY,
    BIP39,
    LEDGER,
}

export class KeyInfo {
    public static fromObject(o: KeyInfoEntry): KeyInfo {
        const addresses = new Map();
        o.addresses.forEach((addressInfoEntry, userFriendlyAddress) => {
            addresses.set(userFriendlyAddress, AddressInfo.fromObject(addressInfoEntry));
        });
        return new KeyInfo(o.id, o.label, addresses, o.contracts, o.type);
    }

    public constructor(public id: string,
                       public label: string,
                       public addresses: Map</*address*/ string, AddressInfo>,
                       public contracts: ContractInfo[],
                       public type: KeyStorageType) {}

    public toObject(): KeyInfoEntry {
        const addresses = new Map();
        this.addresses.forEach((addressInfo, userFriendlyAddress) => {
            addresses.set(userFriendlyAddress, addressInfo.toObject());
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
    addresses: Map</*address*/ string, AddressInfoEntry>;
    contracts: ContractInfo[];
    type: KeyStorageType;
}
