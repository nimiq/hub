/// <reference path="../../node_modules/@nimiq/core-types/Nimiq.d.ts" />
import { WalletInfo, WalletInfoEntry, WalletType } from '@/lib/WalletInfo';
import { AccountInfoEntry } from '@/lib/AccountInfo';
import { ContractInfo, ContractType } from '@/lib/ContractInfo';
import { Utf8Tools } from '@nimiq/utils';

//              0       8       16      24      32      40      48      56     63
const BASE64 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+-";
const BASE64_LOOKUP = new Map<string, number>();
BASE64.split('').forEach((character, value) => BASE64_LOOKUP.set(character, value));

export class CookieJar {

    // cookie storage:                   4096 byte
    // buffer for tracking cookies:    -   96 byte
    // cookie boilerplate:             -   11 byte
    // expiry date:                    -    8 byte
    //--------------------------------------------
    // remaining:                        3981 byte
    //
    // Since the cookie is encoded in base64,
    // the available size is only 3/4:
    //
    // available in buffer: 3981 * 3/4 = 2985 byte
    public static readonly COOKIE_SIZE = 2985;

    static encodeString(string: string, buffer: Nimiq.SerialBuffer) {
        const bytes = Utf8Tools.stringToUtf8ByteArray(string);
        buffer.writeVarUint(bytes.length);
        buffer.write(bytes);
    }

    static decodeString(buffer: Nimiq.SerialBuffer): string {
        const size = buffer.readVarUint();
        return Utf8Tools.utf8ByteArrayToString(buffer.read(size));
    }

    static decodeElements(buffer: Nimiq.SerialBuffer) {
        return new Array(buffer.readUint8()).fill(undefined);
    }

    static base64Decode(data: string, pad = 0): Uint8Array {
        if (data.length % 4 != 0) throw new Error(`Data is ${data.length} bytes. Can only compress multiples of 4 (Base 64 > 6 bits > chunks of 24bit = 4 characters for 3 bytes)`);
        const bytes: number[] = [];
        const values = <number[]>data.split('').map(character => BASE64_LOOKUP.get(character));
        for (let index = 0; index < values.length; index += 4) {
            // extract 4x 6 bit chunks from 3 bytes of data
            // base64       AAAAAA BBBBBB CCCCCC DDDDDD
            // bits of byte 111111 112222 222233 333333
            bytes.push(...
                [(values[index] << 2) | ((values[index + 1] & 0x30) >> 4),
                ((values[index + 1] & 0x0f) << 4) | ((values[index + 2] & 0x3c) >> 2),
                ((values[index + 2] & 0x03) << 6) | values[index + 3]]);
        }
        return new Uint8Array(pad ? bytes.slice(0, pad) : bytes);
    }

    static encodeNumber(number: number | undefined, buffer: Nimiq.SerialBuffer) {
        const isNumber = number !== undefined && Number.isInteger(number);
        buffer.writeUint8(isNumber ? 1 : 0);
        if (isNumber) {
            buffer.writeVarUint(number || 0);
        }
    }

    static decodeNumber(buffer: Nimiq.SerialBuffer): number | undefined {
        return (buffer.readUint8() == 1) ? buffer.readVarUint() : undefined;
    }

    static encodeAddress(address: Uint8Array, buffer: Nimiq.SerialBuffer) {
        buffer.write(address);
    }

    static decodeAddress(buffer: Nimiq.SerialBuffer): Uint8Array {
        return buffer.read(20);
    }

    static encodePath(path: string, buffer: Nimiq.SerialBuffer) {
        // "m/44'/242'/0'/0'" > var length, restricted character set
        // TODO m/ == constant?
        // > path.split("'/") > 4xFF
        buffer.writeVarLengthString(path);
    }

    static decodePath(buffer: Nimiq.SerialBuffer): string {
        return buffer.readVarLengthString();
    }

    static encodeId(hex: string, buffer: Nimiq.SerialBuffer) {
        // example "1ee3d926a49c"
        if (hex.length != 12) throw new Error(`not a valid ID ${hex}`);
        buffer.writeVarUint(parseInt(hex, 16));
    }
    static decodeId(buffer: Nimiq.SerialBuffer): string {
        return buffer.readVarUint().toString(16);
    }

    static encodeAccount(account: AccountInfoEntry, buffer: Nimiq.SerialBuffer) {
        this.encodeAddress(account.address, buffer);
        this.encodePath(account.path, buffer);
        this.encodeString(account.label, buffer);
        this.encodeNumber(account.balance, buffer);
    }

    static decodeAccount(buffer: Nimiq.SerialBuffer): AccountInfoEntry {
        return {
            address: this.decodeAddress(buffer),
            path: this.decodePath(buffer),
            label: this.decodeString(buffer),
            balance: this.decodeNumber(buffer),
        };
    }

    static encodeAccounts(accountsMap: Map</*address*/ string, AccountInfoEntry>, buffer: Nimiq.SerialBuffer) {
        const accounts = Array.from(accountsMap.values());
        buffer.writeUint8(accounts.length);
        accounts.forEach(account => this.encodeAccount(account, buffer));
    }

    static decodeAccounts(buffer: Nimiq.SerialBuffer): Map</*address*/ string, AccountInfoEntry> {
        const accountsMap = new Map</*address*/ string, AccountInfoEntry>();
        this.decodeElements(buffer)
            .map(x => this.decodeAccount(buffer))
            .forEach(account => {
                const address = new Nimiq.Address(account.address).toUserFriendlyAddress();
                accountsMap.set(address, account);
            });

        return accountsMap;
    }

    static encodeContractType(type: ContractType, buffer: Nimiq.SerialBuffer) {
        buffer.writeUint8(type.valueOf());
    }

    static decodeContractType(buffer: Nimiq.SerialBuffer): ContractType {
        return <ContractType> buffer.readUint8();
    }

    static encodeContract(contract: ContractInfo, buffer: Nimiq.SerialBuffer) {
        this.encodeAddress(contract.address, buffer);
        this.encodeContractType(contract.type, buffer);
        this.encodeString(contract.label, buffer);
        this.encodePath(contract.ownerPath, buffer);
    }

    static decodeContract(buffer: Nimiq.SerialBuffer): ContractInfo {
        return {
            address: this.decodeAddress(buffer),
            type: this.decodeContractType(buffer),
            label: this.decodeString(buffer),
            ownerPath: this.decodePath(buffer),
        }
    }

    static encodeContracts(contracts: ContractInfo[], buffer: Nimiq.SerialBuffer) {
        buffer.writeUint8(contracts.length);
        contracts.forEach(contract => this.encodeContract(contract, buffer));
    }

    static decodeContracts(buffer: Nimiq.SerialBuffer): ContractInfo[] {
        return this.decodeElements(buffer).map(x => this.decodeContract(buffer));
    }

    static encodeType(type: WalletType, buffer: Nimiq.SerialBuffer) {
        buffer.writeUint8(type.valueOf());
    }

    static decodeType(buffer: Nimiq.SerialBuffer): WalletType {
        return <WalletType> buffer.readUint8();
    }

    static encodeWallet(wallet: WalletInfoEntry, buffer: Nimiq.SerialBuffer) {
        this.encodeId(wallet.id, buffer);
        this.encodeType(wallet.type, buffer);
        this.encodeString(wallet.label, buffer);
        this.encodeAccounts(wallet.accounts, buffer);
        this.encodeContracts(wallet.contracts, buffer);
    }

    static decodeWallet(buffer: Nimiq.SerialBuffer): WalletInfoEntry {
        return {
            id: this.decodeId(buffer),
            type: this.decodeType(buffer),
            label: this.decodeString(buffer),
            accounts: this.decodeAccounts(buffer),
            contracts: this.decodeContracts(buffer),
        }
    }

    static encodeWallets(wallets: WalletInfoEntry[]): Uint8Array  {
        const buffer = new Nimiq.SerialBuffer(this.COOKIE_SIZE);
        buffer.writeUint8(wallets.length);
        wallets.forEach(wallet => this.encodeWallet(wallet, buffer))
        return Uint8Array.from(buffer.subarray(0, buffer.writePos));
    }

    static decodeWallets(data: Uint8Array): WalletInfoEntry[] {
        const buffer = new Nimiq.SerialBuffer(data);
        return this.decodeElements(buffer).map(x => this.decodeWallet(buffer));
    }

    static encode(wallets: WalletInfoEntry[]) {
        const buffer = this.encodeWallets(wallets);
        return Nimiq.BufferUtils.toBase64(buffer);
    }

    static decode(data: string): WalletInfoEntry[] {
        if (data.trim().length < 1) return [];
        const buffer = this.base64Decode(data);
        return this.decodeWallets(buffer);
    }

    public static fill(wallets: WalletInfoEntry[]) {
        const maxAge = 60 * 60 * 24 * 365;
        const encodedWallets = this.encode(wallets);
        document.cookie = `k=${encodedWallets};max-age=${maxAge.toString()}`;
    }

    public static eat(): WalletInfoEntry[] {
        return this.decode(document.cookie);
    }

    static requiredBytes(wallets: WalletInfoEntry[]) {
        const buffer = this.encode(wallets);
        return Utf8Tools.stringToUtf8ByteArray(buffer).length;
    }

    public static willFit(wallets: WalletInfoEntry[]) {
        try {
            return this.requiredBytes(wallets) < this.COOKIE_SIZE;
        }
        catch (e) {
            if (e.name === 'RangeError') return false;
            throw e;
        }
    }

    public static willFitOneMore(wallets: WalletInfoEntry[]) {
        try {
            const bytes = this.requiredBytes(wallets);
            // console.log(bytes / wallets.length * (wallets.length + 2));
            return (bytes / wallets.length * (wallets.length + 2)) < this.COOKIE_SIZE;
        }
        catch(e){
            return false;
        }
    }


}
