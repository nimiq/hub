import {AccountInfo, AccountInfoEntry} from './AccountInfo';
import {ContractInfo} from './ContractInfo';

export enum WalletType {
    LEGACY,
    BIP39,
    LEDGER,
}

export class WalletInfo {
    public static fromObject(o: WalletInfoEntry): WalletInfo {
        const accounts = new Map<string, AccountInfo>();
        o.accounts.forEach((accountInfoEntry, userFriendlyAddress) => {
            accounts.set(userFriendlyAddress, AccountInfo.fromObject(accountInfoEntry));
        });
        return new WalletInfo(o.id, o.label, accounts, o.contracts, o.type);
    }

    public constructor(public id: string,
                       public label: string,
                       public accounts: Map</*address*/ string, AccountInfo>,
                       public contracts: ContractInfo[],
                       public type: WalletType) {}

    public toObject(): WalletInfoEntry {
        const accounts = new Map();
        this.accounts.forEach((addressInfo, userFriendlyAddress) => {
            accounts.set(userFriendlyAddress, addressInfo.toObject());
        });
        return {
            id: this.id,
            label: this.label,
            accounts,
            contracts: this.contracts,
            type: this.type,
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
}
