import { VestingContract, HashedTimeLockedContract } from './PublicRequestTypes';

export enum ContractType {
    VESTING,
    HTLC,
}

export type ContractInfo = VestingContractInfo | HashedTimeLockedContractInfo;

export class VestingContractInfo {
    public static fromObject(o: VestingContractInfoEntry): VestingContractInfo {
        return new VestingContractInfo(
            o.label,
            new Nimiq.Address(new Nimiq.SerialBuffer(o.address)),
            new Nimiq.Address(new Nimiq.SerialBuffer(o.owner)),
            o.start,
            o.stepAmount,
            o.stepBlocks,
            o.totalAmount,
            o.balance,
        );
    }

    public readonly type: ContractType = ContractType.VESTING;

    public constructor(
        public label: string,
        public address: Nimiq.Address,
        public owner: Nimiq.Address,
        public start: number,
        public stepAmount: number,
        public stepBlocks: number,
        public totalAmount: number,
        public balance?: number,
    ) {}

    public get userFriendlyAddress(): string {
        return this.address.toUserFriendlyAddress();
    }

    public toObject(): VestingContractInfoEntry {
        return {
            type: this.type,
            label: this.label,
            address: this.address.serialize(),
            owner: this.owner.serialize(),
            start: this.start,
            stepAmount: this.stepAmount,
            stepBlocks: this.stepBlocks,
            totalAmount: this.totalAmount,
            balance: this.balance,
        };
    }

    public toContractType(): VestingContract {
        return {
            type: ContractType.VESTING,
            address: this.userFriendlyAddress,
            label: this.label,
            owner: this.owner.toUserFriendlyAddress(),
            start: this.start,
            stepAmount: this.stepAmount,
            stepBlocks: this.stepBlocks,
            totalAmount: this.totalAmount,
        };
    }
}

export class HashedTimeLockedContractInfo {
    public static fromObject(o: HashedTimeLockedContractInfoEntry): HashedTimeLockedContractInfo {
        return new HashedTimeLockedContractInfo(
            o.label,
            new Nimiq.Address(new Nimiq.SerialBuffer(o.address)),
            new Nimiq.Address(new Nimiq.SerialBuffer(o.sender)),
            new Nimiq.Address(new Nimiq.SerialBuffer(o.recipient)),
            new Nimiq.Hash(new Nimiq.SerialBuffer(o.hashRoot)),
            o.hashCount,
            o.timeout,
            o.totalAmount,
            o.balance,
        );
    }

    public readonly type: ContractType = ContractType.HTLC;

    public constructor(
        public label: string,
        public address: Nimiq.Address,
        public sender: Nimiq.Address,
        public recipient: Nimiq.Address,
        public hashRoot: Nimiq.Hash,
        public hashCount: number,
        public timeout: number,
        public totalAmount: number,
        public balance?: number,
    ) {}

    public get userFriendlyAddress(): string {
        return this.address.toUserFriendlyAddress();
    }

    public toObject(): HashedTimeLockedContractInfoEntry {
        return {
            type: this.type,
            label: this.label,
            address: this.address.serialize(),
            sender: this.sender.serialize(),
            recipient: this.recipient.serialize(),
            hashRoot: this.hashRoot.serialize(),
            hashCount: this.hashCount,
            timeout: this.timeout,
            totalAmount: this.totalAmount,
            balance: this.balance,
        };
    }

    public toContractType(): HashedTimeLockedContract {
        return {
            type: ContractType.VESTING,
            address: this.userFriendlyAddress,
            label: this.label,
            sender: this.sender.toUserFriendlyAddress(),
            recipient: this.recipient.toUserFriendlyAddress(),
            hashRoot: this.hashRoot.toHex(),
            hashCount: this.hashCount,
            timeout: this.timeout,
            totalAmount: this.totalAmount,
        };
    }
}

/*
 * Database Types
 */
export interface VestingContractInfoEntry {
    type: ContractType;
    label: string;
    address: Uint8Array;
    owner: Uint8Array;
    start: number;
    stepAmount: number;
    stepBlocks: number;
    totalAmount: number;
    balance?: number;
}

export interface HashedTimeLockedContractInfoEntry {
    type: ContractType;
    label: string;
    address: Uint8Array;
    sender: Uint8Array;
    recipient: Uint8Array;
    hashRoot: Uint8Array;
    hashCount: number;
    timeout: number;
    totalAmount: number;
    balance?: number;
}
