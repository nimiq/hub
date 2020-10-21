import { AccountInfo, AccountInfoEntry } from './AccountInfo';
import { BtcAddressInfo, BtcAddressInfoEntry } from './bitcoin/BtcAddressInfo';
import {
    ContractInfo,
    ContractInfoEntry,
    ContractInfoHelper,
} from './ContractInfo';
import { Account } from './PublicRequestTypes';
import { labelKeyguardAccount } from './LabelingMachine';
import WalletInfoCollector from './WalletInfoCollector';
import { WalletStore } from '../lib/WalletStore';
import { WalletType } from './Constants';

export class WalletInfo {
    public static fromObject(o: WalletInfoEntry): WalletInfo {
        const accounts = new Map<string, AccountInfo>();
        o.accounts.forEach((accountInfoEntry, userFriendlyAddress) => {
            accounts.set(userFriendlyAddress, AccountInfo.fromObject(accountInfoEntry));
        });
        const contracts = o.contracts.map((contract) => ContractInfoHelper.fromObject(contract));

        // Polyfill BTC address lists for pre-BTC wallets
        if (!o.btcAddresses) o.btcAddresses = { internal: [], external: [] };

        const btcAddresses = {
            internal: o.btcAddresses.internal
                .map((btcAddressInfoEntry) => BtcAddressInfo.fromObject(btcAddressInfoEntry)),
            external: o.btcAddresses.external
                .map((btcAddressInfoEntry) => BtcAddressInfo.fromObject(btcAddressInfoEntry)),
        };

        return new WalletInfo(o.id, o.keyId, o.label, accounts, contracts, o.type,
            o.keyMissing, o.fileExported, o.wordsExported, o.btcXPub, btcAddresses);
    }

    public static objectToAccountType(o: WalletInfoEntry): Account {
        // Polyfill BTC address lists for pre-BTC wallets
        if (!o.btcAddresses) o.btcAddresses = { internal: [], external: [] };

        return {
            accountId: o.id,
            label: o.label,
            type: o.type,
            fileExported: o.fileExported,
            wordsExported: o.wordsExported,
            addresses: Array.from(o.accounts.values()).map((address) => AccountInfo.objectToAddressType(address)),
            contracts: o.contracts.map((contract) => ContractInfoHelper.objectToContractType(contract)),
            btcAddresses: {
                internal: o.btcAddresses.internal.map((entry) => BtcAddressInfo.objectToBtcAddressType(entry)),
                external: o.btcAddresses.external.map((entry) => BtcAddressInfo.objectToBtcAddressType(entry)),
            },
        };
    }

    public constructor(
        public id: string,
        public keyId: string,
        public label: string,
        public accounts: Map</*address*/ string, AccountInfo>,
        public contracts: ContractInfo[],
        public type: WalletType,
        public keyMissing: boolean = false,
        public fileExported: boolean = false,
        public wordsExported: boolean = false,
        public btcXPub?: string,
        public btcAddresses: {
            internal: BtcAddressInfo[],
            external: BtcAddressInfo[],
        } = {
            internal: [],
            external: [],
        },
    ) {}

    public get defaultLabel(): string {
        return labelKeyguardAccount(this.accounts.keys().next().value);
    }

    public get labelForKeyguard(): string | undefined {
        return this.type !== WalletType.LEGACY ? this.label : undefined;
    }

    public findContractByAddress(address: Nimiq.Address): ContractInfo | undefined {
        return this.contracts.find((contract) => contract.address.equals(address));
    }

    public findContractsByOwner(address: Nimiq.Address): ContractInfo[] {
        return this.contracts.filter((contract) => {
            switch (contract.type) {
                case Nimiq.Account.Type.VESTING: return contract.owner.equals(address);
                case Nimiq.Account.Type.HTLC:
                    return contract.sender.equals(address)
                        || contract.recipient.equals(address);
                default: return false;
            }
        });
    }

    public findSignerForAddress(address: Nimiq.Address): AccountInfo | null {
        const addressInfo: AccountInfo | undefined = this.accounts.get(address.toUserFriendlyAddress());
        if (addressInfo) return addressInfo; // regular address
        // address belongs to a contract
        const contract = this.findContractByAddress(address);
        if (!contract) return null;
        if (contract.type !== Nimiq.Account.Type.VESTING) {
            throw new Error('Currently only Vesting contracts are supported');
        }
        return this.accounts.get(contract.owner.toUserFriendlyAddress()) || null;
    }

    public findBtcAddressInfo(
        address: string,
        deriveIfNotFound = true,
    ): BtcAddressInfo | null | Promise<BtcAddressInfo | null> {
        const addressInfo = this.btcAddresses.internal.find((ai) => ai.address === address)
            || this.btcAddresses.external.find((ai) => ai.address === address)
            || null;

        if (addressInfo || !deriveIfNotFound) return addressInfo;

        return new Promise<BtcAddressInfo | null>(async (resolve) => {
            // Derive new addresses starting from the last used index
            let index = this.btcAddresses.external.length - 1;
            for (; index >= 0; index--) {
                if (this.btcAddresses.external[index].used) break;
            }

            const newAddresses = await WalletInfoCollector.deriveBitcoinAddresses(this.btcXPub!, index + 1);

            let i = index + 1;
            for (const external of newAddresses.external) {
                this.btcAddresses.external[i] = external;
                i += 1;
            }
            i = index + 1;
            for (const internal of newAddresses.internal) {
                this.btcAddresses.internal[i] = internal;
                i += 1;
            }

            await WalletStore.Instance.put(this);

            resolve(this.findBtcAddressInfo(address, false) as BtcAddressInfo | null);
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
            keyId: this.keyId,
            label: this.label,
            accounts: accountEntries,
            contracts: contractEntries,
            type: this.type,
            keyMissing: this.keyMissing,
            fileExported: this.fileExported,
            wordsExported: this.wordsExported,
            btcXPub: this.btcXPub,
            btcAddresses: {
                internal: this.btcAddresses.internal.map((btcAddressInfo) => btcAddressInfo.toObject()),
                external: this.btcAddresses.external.map((btcAddressInfo) => btcAddressInfo.toObject()),
            },
        };
    }

    public toAccountType(): Account {
        return {
            accountId: this.id,
            label: this.label,
            type: this.type,
            fileExported: this.fileExported,
            wordsExported: this.wordsExported,
            addresses: Array.from(this.accounts.values()).map((address) => address.toAddressType()),
            contracts: this.contracts.map((contract) => contract.toContractType()),
            btcAddresses: {
                internal: this.btcAddresses.internal.map((btcAddressInfo) => btcAddressInfo.toBtcAddressType()),
                external: this.btcAddresses.external.map((btcAddressInfo) => btcAddressInfo.toBtcAddressType()),
            },
        };
    }
}

/*
 * Database Types
 */
export interface WalletInfoEntry {
    id: string;
    keyId: string;
    label: string;
    accounts: Map</*address*/ string, AccountInfoEntry>;
    contracts: ContractInfoEntry[];
    type: WalletType;
    keyMissing: boolean;
    fileExported: boolean;
    wordsExported: boolean;
    btcXPub?: string;
    btcAddresses: {
        internal: BtcAddressInfoEntry[],
        external: BtcAddressInfoEntry[],
    };
}
