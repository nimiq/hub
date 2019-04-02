import { AccountInfo, AccountInfoEntry } from './AccountInfo';
import {
    ContractInfo,
    VestingContractInfo,
    HashedTimeLockedContractInfo,
    ContractInfoEntry,
} from './ContractInfo';

export enum WalletType {
    LEGACY = 1,
    BIP39 = 2,
    LEDGER = 3,
}

export class WalletInfo {
    public static fromObject(o: WalletInfoEntry): WalletInfo {
        const accounts = new Map<string, AccountInfo>();
        o.accounts.forEach((accountInfoEntry, userFriendlyAddress) => {
            accounts.set(userFriendlyAddress, AccountInfo.fromObject(accountInfoEntry));
        });
        const contracts = o.contracts.map((contract) => ContractInfo.fromObject(contract));
        return new WalletInfo(o.id, o.label, accounts, contracts, o.type,
            o.keyMissing, o.fileExported, o.wordsExported);
    }

    public constructor(public id: string,
                       public label: string,
                       public accounts: Map</*address*/ string, AccountInfo>,
                       public contracts: ContractInfo[],
                       public type: WalletType,
                       public keyMissing: boolean = false,
                       public fileExported: boolean = false,
                       public wordsExported: boolean = false) {}

    public findContractByAddress(address: Nimiq.Address): ContractInfo | undefined {
        return this.contracts.find((contract) => contract.address.equals(address));
    }

    public findContractsByOwner(address: Nimiq.Address): ContractInfo[] {
        return this.contracts.filter((contract) => {
            switch (contract.type) {
                case Nimiq.Account.Type.VESTING: return (contract as VestingContractInfo).owner.equals(address);
                case Nimiq.Account.Type.HTLC:
                    return (contract as HashedTimeLockedContractInfo).sender.equals(address)
                        || (contract as HashedTimeLockedContractInfo).recipient.equals(address);
                default: return false;
            }
        });
    }

    public setContract(updatedContract: ContractInfo) {
        const index = this.contracts.findIndex((contract) => contract.address.equals(updatedContract.address));
        if (index < 0) {
            // Is new contract
            this.contracts.push(updatedContract);
            return;
        }

        this.contracts.splice(index, 1, updatedContract);
    }

    public toObject(): WalletInfoEntry {
        const accountEntries = new Map<string, AccountInfoEntry>();
        this.accounts.forEach((accountInfo, userFriendlyAddress) => {
            accountEntries.set(userFriendlyAddress, accountInfo.toObject());
        });
        const contractEntries = this.contracts.map((contract) => contract.toObject());
        return {
            id: this.id,
            label: this.label,
            accounts: accountEntries,
            contracts: contractEntries,
            type: this.type,
            keyMissing: this.keyMissing,
            fileExported: this.fileExported,
            wordsExported: this.wordsExported,
        };
    }
}

/*
 * Database Types
 */
export interface WalletInfoEntry {
    id: string;
    label: string;
    accounts: Map</*address*/ string, AccountInfoEntry>;
    contracts: ContractInfoEntry[];
    type: WalletType;
    keyMissing: boolean;
    fileExported: boolean;
    wordsExported: boolean;
}
