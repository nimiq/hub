import { AccountInfo, AccountInfoEntry } from './AccountInfo';
import { ContractInfo } from './ContractInfo';

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
        return new WalletInfo(o.id, o.label, accounts, o.contracts, o.type, o.keyMissing);
    }

    public constructor(public id: string,
                       public label: string,
                       public accounts: Map</*address*/ string, AccountInfo>,
                       public contracts: ContractInfo[],
                       public type: WalletType,
                       public keyMissing: boolean = false) {}

    public toObject(): WalletInfoEntry {
        const accountEntries = new Map<string, AccountInfoEntry>();
        this.accounts.forEach((accountInfo, userFriendlyAddress) => {
            accountEntries.set(userFriendlyAddress, accountInfo.toObject());
        });
        return {
            id: this.id,
            label: this.label,
            accounts: accountEntries,
            contracts: this.contracts,
            type: this.type,
            keyMissing: this.keyMissing,
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
    contracts: ContractInfo[];
    type: WalletType;
    keyMissing: boolean;
}
