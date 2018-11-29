export enum ContractType {
    VESTING,
    HTLC,
}

export interface ContractInfo {
    address: Uint8Array;
    label: string;
    ownerPath: string;
    type: ContractType;
}
