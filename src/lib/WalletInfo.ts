import { AccountInfo, AccountInfoEntry } from './AccountInfo';
import { BtcAddressInfo, BtcAddressInfoEntry } from './bitcoin/BtcAddressInfo';
import { PolygonAddressEntry, PolygonAddressInfo } from './polygon/PolygonAddressInfo';
import {
    ContractInfo,
    ContractInfoEntry,
    ContractInfoHelper,
} from './ContractInfo';
import { Account, RequestType } from '../../client/PublicRequestTypes';
import { labelKeyguardAccount } from './LabelingMachine';
import WalletInfoCollector from './WalletInfoCollector';
import { WalletStore } from '../lib/WalletStore';
import { WalletType } from './Constants';
import { makeUid } from './Uid';
import AddressUtils from './AddressUtils';

export class WalletInfo {
    public static fromObject(o: WalletInfoEntry): WalletInfo {
        const accounts = new Map<string, AccountInfo>();
        o.accounts.forEach((accountInfoEntry, userFriendlyAddress) => {
            accounts.set(userFriendlyAddress, AccountInfo.fromObject(accountInfoEntry));
        });
        const contracts = o.contracts.map((contract) => ContractInfoHelper.fromObject(contract));

        // Polyfill BTC address lists for pre-BTC wallets
        if (!o.btcAddresses) o.btcAddresses = { internal: [], external: [] };

        // Polyfill Polygon address list for pre-Polygon wallets
        if (!o.polygonAddresses) o.polygonAddresses = [];

        const btcAddresses = {
            internal: o.btcAddresses.internal
                .map((btcAddressInfoEntry) => BtcAddressInfo.fromObject(btcAddressInfoEntry)),
            external: o.btcAddresses.external
                .map((btcAddressInfoEntry) => BtcAddressInfo.fromObject(btcAddressInfoEntry)),
        };

        const polygonAddresses = o.polygonAddresses.map(
            (polygonAddressEntry) => PolygonAddressInfo.fromObject(polygonAddressEntry),
        );

        return new WalletInfo(o.id, o.keyId, o.label, accounts, contracts, o.type,
            o.keyMissing, o.fileExported, o.wordsExported, o.btcXPub, btcAddresses, polygonAddresses);
    }

    public static async objectToAccountType(o: WalletInfoEntry, requestType: RequestType): Promise<Account> {
        // Polyfill BTC address lists for pre-BTC wallets
        if (!o.btcAddresses) o.btcAddresses = { internal: [], external: [] };

        // Polyfill Polygon address list for pre-Polygon wallets
        if (!o.polygonAddresses) o.polygonAddresses = [];

        const accountInfoEntries = Array.from(o.accounts.values());

        return {
            accountId: o.id,
            label: o.label,
            type: o.type,
            fileExported: o.fileExported,
            wordsExported: o.wordsExported,
            addresses: accountInfoEntries.map((entry) => AccountInfo.objectToAddressType(entry)),
            contracts: o.contracts.map((contract) => ContractInfoHelper.objectToContractType(contract)),
            btcAddresses: {
                internal: o.btcAddresses.internal.map((entry) => BtcAddressInfo.objectToBtcAddressType(entry)),
                external: o.btcAddresses.external.map((entry) => BtcAddressInfo.objectToBtcAddressType(entry)),
            },
            polygonAddresses: o.polygonAddresses.map((entry) => PolygonAddressInfo.objectToPolygonAddressType(entry)),
            uid: o.keyId
                ? await makeUid(o.keyId, AddressUtils.toUserFriendlyAddress(accountInfoEntries[0].address))
                : '',
            requestType,
        };
    }

    private _uid: string | undefined;

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
        public polygonAddresses: PolygonAddressInfo[] = [],
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

        return new Promise<BtcAddressInfo | null>(async (resolve, reject) => {
            try {
                // Derive new addresses starting from the last used index
                let index = Math.min(this.btcAddresses.external.length, this.btcAddresses.internal.length) - 1;
                let lastExternalUsed = 0;
                let lastInternalUsed = 0;
                for (; index >= 0; index--) {
                    if (!lastExternalUsed && this.btcAddresses.external[index].used) lastExternalUsed = index;
                    if (!lastInternalUsed && this.btcAddresses.internal[index].used) lastInternalUsed = index;
                    if (lastExternalUsed && lastInternalUsed) break;
                }
                index = Math.min(lastExternalUsed, lastInternalUsed);

                const newAddresses = await WalletInfoCollector.detectBitcoinAddresses(this.btcXPub!, index + 1);

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
            } catch (e) {
                reject(e);
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
            polygonAddresses: this.polygonAddresses.map((polygonAddressInfo) => polygonAddressInfo.toObject()),
        };
    }

    public async toAccountType(requestType: RequestType): Promise<Account> {
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
            polygonAddresses: this.polygonAddresses.map((address) => address.toPolygonAddressType()),
            uid: await this.getUid(),
            requestType,
        };
    }

    public async getUid(): Promise<string> {
        return this._uid
            || (this._uid = await makeUid(this.keyId, Array.from(this.accounts.values())[0].userFriendlyAddress));
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
    btcAddresses?: {
        internal: BtcAddressInfoEntry[],
        external: BtcAddressInfoEntry[],
    };
    polygonAddresses?: PolygonAddressEntry[];
}
