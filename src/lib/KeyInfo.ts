enum KeyStorageType {
    LEGACY,
    BIP39,
    LEDGER,
}
enum ContractType {
    VESTING,
    HTLC,
}

interface KeyInfo {
    id: string;
    label: string;
    addresses: Map</*path*/ string, AddressInfo>;
    contracts: Map</*id*/ string, ContractInfo>;
    type: KeyStorageType;
}

interface AddressInfo {
    path: string;
    label: string;
    address: Nimiq.Address;
}

interface ContractInfo {
    id: string;
    label: string;
    ownerPath: string;
    type: ContractType;
}
