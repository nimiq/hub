import { AccountInfo, AccountInfoEntry } from './AccountInfo';
import { BtcAddressInfo, BtcAddressInfoEntry } from './bitcoin/BtcAddressInfo';
import { EXTERNAL_INDEX, INTERNAL_INDEX } from './bitcoin/BitcoinConstants';
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
            o.keyMissing, o.fileExported, o.wordsExported, o.backupCodesExported, o.btcXPub, btcAddresses,
            polygonAddresses, o.permissions);
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
            backupCodesExported: !!o.backupCodesExported,
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
        public backupCodesExported: boolean = false,
        public btcXPub?: string,
        public btcAddresses: {
            internal: BtcAddressInfo[],
            external: BtcAddressInfo[],
        } = {
            internal: [],
            external: [],
        },
        public polygonAddresses: PolygonAddressInfo[] = [],
        public permissions: Record<string, RequestType[]> = {},
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
                case Nimiq.AccountType.Vesting: return contract.owner.equals(address);
                case Nimiq.AccountType.HTLC:
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
        if (contract.type !== Nimiq.AccountType.Vesting) {
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

        // Address not yet known; detect and store additional addresses from the network, then look again.
        return this.syncBtcAddresses().then(() => this.findBtcAddressInfo(address, false));
    }

    /**
     * Detect this wallet's Bitcoin addresses on the network, continuing after the chain's last used address.
     * The newly synced addresses are persisted so that any address handed out (e.g. an external address returned by
     * ChooseAddress) is stored and can later be linked back to this wallet.
     * @param chains - The BIP44 chains to sync: EXTERNAL_INDEX and/or INTERNAL_INDEX (both by default).
     */
    public async syncBtcAddresses(
        chains: Array<typeof EXTERNAL_INDEX | typeof INTERNAL_INDEX> = [EXTERNAL_INDEX, INTERNAL_INDEX],
        skipKnownUsedAddresses = false,
    ): Promise<{
        internal: BtcAddressInfo[],
        external: BtcAddressInfo[],
    }> {
        await Promise.all(chains.map(async (chain) => {
            const addresses = chain === EXTERNAL_INDEX ? this.btcAddresses.external : this.btcAddresses.internal;

            let start: number;
            let addressInfosToSkip: BtcAddressInfo[];
            if (skipKnownUsedAddresses) {
                // Complete re-scan to pick up addresses that became used since the last sync, but skip re-querying the
                // ones already known to be used.
                start = 0;
                addressInfosToSkip = addresses.filter((info) => info.used);
            } else {
                // Derive new addresses starting after this chain's last used index.
                let lastUsed = addresses.length - 1;
                while (lastUsed >= 0 && !addresses[lastUsed].used) lastUsed--;
                start = lastUsed + 1;
                addressInfosToSkip = [];
            }

            const detected = await WalletInfoCollector.detectBitcoinAddresses(
                this.btcXPub!, chain, start, /* maxUnusedAddresses */ Infinity, addressInfosToSkip,
            );

            // Overwrite/extend the stored addresses at each entry's derivation index.
            detected.forEach((info) => { addresses[info.index] = info; });
        }));

        await WalletStore.Instance.put(this);

        return this.btcAddresses;
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
            backupCodesExported: this.backupCodesExported,
            btcXPub: this.btcXPub,
            btcAddresses: {
                internal: this.btcAddresses.internal.map((btcAddressInfo) => btcAddressInfo.toObject()),
                external: this.btcAddresses.external.map((btcAddressInfo) => btcAddressInfo.toObject()),
            },
            polygonAddresses: this.polygonAddresses.map((polygonAddressInfo) => polygonAddressInfo.toObject()),
            permissions: this.permissions,
        };
    }

    public async toAccountType(requestType: RequestType): Promise<Account> {
        return {
            accountId: this.id,
            label: this.label,
            type: this.type,
            fileExported: this.fileExported,
            wordsExported: this.wordsExported,
            backupCodesExported: this.backupCodesExported,
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

    public equals(other: WalletInfo): boolean {
        if (this === other) return true;
        if (this.id !== other.id) return false;
        if (this.keyId !== other.keyId) return false;
        if (this.label !== other.label) return false;
        if (this.type !== other.type) return false;
        if (this.keyMissing !== other.keyMissing) return false;
        if (this.fileExported !== other.fileExported) return false;
        if (this.wordsExported !== other.wordsExported) return false;
        if (this.backupCodesExported !== other.backupCodesExported) return false;
        if (this.btcXPub !== other.btcXPub) return false;

        if (this.accounts.size !== other.accounts.size) return false;
        for (const [address, accountInfo] of this.accounts) {
            const otherAccountInfo = other.accounts.get(address);
            if (!otherAccountInfo || !accountInfo.equals(otherAccountInfo)) return false;
        }

        if (this.contracts.length !== other.contracts.length) return false;
        for (let i = 0; i < this.contracts.length; i++) {
            if (!this.contracts[i].equals(other.contracts[i])) return false;
        }

        if (this.btcAddresses.internal.length !== other.btcAddresses.internal.length) return false;
        for (let i = 0; i < this.btcAddresses.internal.length; i++) {
            if (!this.btcAddresses.internal[i].equals(other.btcAddresses.internal[i])) return false;
        }

        if (this.btcAddresses.external.length !== other.btcAddresses.external.length) return false;
        for (let i = 0; i < this.btcAddresses.external.length; i++) {
            if (!this.btcAddresses.external[i].equals(other.btcAddresses.external[i])) return false;
        }

        if (this.polygonAddresses.length !== other.polygonAddresses.length) return false;
        for (let i = 0; i < this.polygonAddresses.length; i++) {
            if (!this.polygonAddresses[i].equals(other.polygonAddresses[i])) return false;
        }

        const thisPermissionKeys = Object.keys(this.permissions).sort();
        const otherPermissionKeys = Object.keys(other.permissions).sort();
        if (thisPermissionKeys.length !== otherPermissionKeys.length) return false;
        for (let i = 0; i < thisPermissionKeys.length; i++) {
            const key = thisPermissionKeys[i];
            if (key !== otherPermissionKeys[i]) return false;
            const thisRequestTypes = this.permissions[key].slice().sort();
            const otherRequestTypes = other.permissions[key].slice().sort();
            if (thisRequestTypes.length !== otherRequestTypes.length) return false;
            for (let j = 0; j < thisRequestTypes.length; j++) {
                if (thisRequestTypes[j] !== otherRequestTypes[j]) return false;
            }
        }

        return true;
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
    // The following were added over time, and might be undefined on older persisted entries in the WalletStore:
    backupCodesExported?: boolean;
    btcXPub?: string;
    btcAddresses?: {
        internal: BtcAddressInfoEntry[],
        external: BtcAddressInfoEntry[],
    };
    polygonAddresses?: PolygonAddressEntry[];
    permissions?: Record<string, RequestType[]>;
}
