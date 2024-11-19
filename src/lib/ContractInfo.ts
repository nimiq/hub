import { VestingContract, HashedTimeLockedContract, Contract } from '../../client/PublicRequestTypes';
import AddressUtils from './AddressUtils';
import { labelAddress } from './LabelingMachine';

export class ContractInfoHelper {
    public static fromObject(o: ContractInfoEntry): VestingContractInfo | HashedTimeLockedContractInfo {
        switch (o.type) {
            case Nimiq.AccountType.Vesting:
                return VestingContractInfo.fromObject(o);
            case Nimiq.AccountType.HTLC:
                return HashedTimeLockedContractInfo.fromObject(o);
            // @ts-ignore Property 'type' does not exist on type 'never'.
            default: throw new Error('Unknown contract type: ' + o.type);
        }
    }

    // Used in iframe
    public static objectToContractType(o: ContractInfoEntry): VestingContract | HashedTimeLockedContract {
        switch (o.type) {
            case Nimiq.AccountType.Vesting:
                return VestingContractInfo.objectToContractType(o);
            case Nimiq.AccountType.HTLC:
                return HashedTimeLockedContractInfo.objectToContractType(o);
            // @ts-ignore Property 'type' does not exist on type 'never'.
            default: throw new Error('Unknown contract type: ' + o.type);
        }
    }
}

export class VestingContractInfo {
    public static fromObject(o: VestingContractInfoEntry): VestingContractInfo {
        return new VestingContractInfo(
            o.label,
            new Nimiq.Address(o.address),
            new Nimiq.Address(o.owner),
            o.startTime,
            o.stepAmount,
            o.timeStep,
            o.totalAmount,
            o.balance,
        );
    }

    // Used in iframe
    public static objectToContractType(o: VestingContractInfoEntry): VestingContract {
        return {
            type: Nimiq.AccountType.Vesting,
            label: o.label,
            address: AddressUtils.toUserFriendlyAddress(o.address),
            owner: AddressUtils.toUserFriendlyAddress(o.owner),
            startTime: o.startTime,
            stepAmount: o.stepAmount,
            timeStep: o.timeStep,
            totalAmount: o.totalAmount,
        };
    }

    public type: Nimiq.AccountType.Vesting = Nimiq.AccountType.Vesting;
    public walletId?: string;

    public constructor(
        public label: string,
        public address: Nimiq.Address,
        public owner: Nimiq.Address,
        public startTime: number,
        public stepAmount: number,
        public timeStep: number,
        public totalAmount: number,
        public balance?: number,
    ) {}

    public get userFriendlyAddress(): string {
        return this.address.toUserFriendlyAddress();
    }

    public get defaultLabel(): string {
        return labelAddress(this.userFriendlyAddress);
    }

    public toObject(): VestingContractInfoEntry {
        return {
            type: this.type,
            label: this.label,
            address: this.address.serialize(),
            owner: this.owner.serialize(),
            startTime: this.startTime,
            stepAmount: this.stepAmount,
            timeStep: this.timeStep,
            totalAmount: this.totalAmount,
            balance: this.balance,
        };
    }

    public toContractType(): VestingContract {
        return {
            type: this.type,
            label: this.label,
            address: this.userFriendlyAddress,
            owner: this.owner.toUserFriendlyAddress(),
            startTime: this.startTime,
            stepAmount: this.stepAmount,
            timeStep: this.timeStep,
            totalAmount: this.totalAmount,
        };
    }

    /**
     * Calculates the available amount of a vesting contract for a given blockchain height
     *
     * First, an explanation of the parameters of a vesting contract:
     * totalAmount: The total value of a vesting contract (fixed during creation, cannot be changed).
     * stepAmount: How much value is released at every vesting step. The total amount does not have
     *             to divide evenly through this amount. The last vesting step amount can be smaller
     *             then the previous steps.
     * stepBlocks: The number of blocks between step amount releases.
     * start: The block height at which the first step starts to count.
     *
     * To calculate the amount available, we start by dividing the number of blocks passed since
     * the contract's start height through its stepBlocks, to determine how many vesting steps have
     * passed. The floored number of steps gets multiplied by the stepAmount to calculate all so far
     * released value:
     *      Math.floor((height - this.start) / this.stepBlocks)) * this.stepAmount
     *
     * Because the vested amount cannot be negative (in case start block height is higher than the
     * blockchain height), the above calculation is set to at least 0:
     *      Math.max(0, <previous result>)
     *
     * Because the last step of a vesting contract is always the remainder and can be smaller than
     * stepAmount, we safeguard the maximum possible released value by taking the smaller of
     * the above calculated released amount and the contract's totalAmount:
     *      Math.min(this.totalAmount, <previous result>)
     *
     * Finally, the available amount needs to account for already withdrawn funds. (The balance
     * reported by the network represents the balance of the contract, including not-yet-released
     * funds.) The amount already withdrawn is the difference between the totalAmount (initial balance)
     * and currentBalance. The withdrawn amount is simply subtracted from the released amount:
     *      <previous result> - (this.totalAmount - currentBalance)
     */
    public calculateAvailableAmount(currentBalance = this.totalAmount) {
        return Math.min(
            this.totalAmount,
            Math.max(0, Math.floor((Date.now() - this.startTime) / this.timeStep)) * this.stepAmount,
        ) - (this.totalAmount - currentBalance);
    }
}

export class HashedTimeLockedContractInfo {
    public static fromObject(o: HashedTimeLockedContractInfoEntry): HashedTimeLockedContractInfo {
        return new HashedTimeLockedContractInfo(
            o.label,
            new Nimiq.Address(o.address),
            new Nimiq.Address(o.sender),
            new Nimiq.Address(o.recipient),
            o.hashRoot,
            o.hashCount,
            o.timeout,
            o.totalAmount,
            o.balance,
        );
    }

    // Used in iframe
    public static objectToContractType(o: HashedTimeLockedContractInfoEntry): HashedTimeLockedContract {
        return {
            type: Nimiq.AccountType.HTLC,
            label: o.label,
            address: AddressUtils.toUserFriendlyAddress(o.address),
            sender: AddressUtils.toUserFriendlyAddress(o.sender),
            recipient: AddressUtils.toUserFriendlyAddress(o.recipient),
            hashRoot: Array.from(o.hashRoot).map((byte) => {
                const hex = byte.toString(16);
                return `${hex.length < 2 ? '0' : ''}${hex}`;
            }).join(''),
            hashCount: o.hashCount,
            timeout: o.timeout,
            totalAmount: o.totalAmount,
        };
    }

    public type: Nimiq.AccountType.HTLC = Nimiq.AccountType.HTLC;
    public walletId?: string;

    public constructor(
        public label: string,
        public address: Nimiq.Address,
        public sender: Nimiq.Address,
        public recipient: Nimiq.Address,
        public hashRoot: Uint8Array,
        public hashCount: number,
        public timeout: number,
        public totalAmount: number,
        public balance?: number,
    ) {}

    public get userFriendlyAddress(): string {
        return this.address.toUserFriendlyAddress();
    }

    public get defaultLabel(): string {
        return labelAddress(this.userFriendlyAddress);
    }

    public toObject(): HashedTimeLockedContractInfoEntry {
        return {
            type: this.type,
            label: this.label,
            address: this.address.serialize(),
            sender: this.sender.serialize(),
            recipient: this.recipient.serialize(),
            hashRoot: this.hashRoot,
            hashCount: this.hashCount,
            timeout: this.timeout,
            totalAmount: this.totalAmount,
            balance: this.balance,
        };
    }

    public toContractType(): HashedTimeLockedContract {
        return {
            type: Nimiq.AccountType.HTLC,
            label: this.label,
            address: this.userFriendlyAddress,
            sender: this.sender.toUserFriendlyAddress(),
            recipient: this.recipient.toUserFriendlyAddress(),
            hashRoot: Nimiq.BufferUtils.toHex(this.hashRoot),
            hashCount: this.hashCount,
            timeout: this.timeout,
            totalAmount: this.totalAmount,
        };
    }
}

export type ContractInfo = VestingContractInfo | HashedTimeLockedContractInfo;

/*
 * Database Types
 */
export interface VestingContractInfoEntry {
    type: Nimiq.AccountType.Vesting;
    label: string;
    address: Uint8Array;
    owner: Uint8Array;
    startTime: number;
    stepAmount: number;
    timeStep: number;
    totalAmount: number;
    balance?: number;
}

export interface HashedTimeLockedContractInfoEntry {
    type: Nimiq.AccountType.HTLC;
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

export type ContractInfoEntry = VestingContractInfoEntry | HashedTimeLockedContractInfoEntry;
