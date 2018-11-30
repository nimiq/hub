import { WalletInfo, WalletInfoEntry, WalletType } from '@/lib/WalletInfo';
import { AccountInfoEntry } from '@/lib/AccountInfo';
import { ContractType, ContractInfo } from '@/lib/ContractInfo';

enum Separator {
    ACCOUNT_ELEMENT = '_',
    ACCOUNT = "\\",
    WALLET_ELEMENT = '~',
    WALLET = "^",
}

const BASE64 =
    //   0       8       16      24      32      40      48      56     63
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+-";
const BASE64_LOOKUP = new Map<string, number>();
BASE64.split('').forEach((character, value) => BASE64_LOOKUP.set(character, value));

export class CookieJar {

    public static Separator = Separator;

    static sanitizeString(string: string): string {
        for (const separator in Separator) {
            string = string.replace(separator, '');
        }
        return string;
    }

    static base64Encode(data: Uint8Array, pad = false): string {
        if (!pad && data.length % 3 != 0) throw new Error(`Data is ${data.length} bytes. Can only compress multiples of 3 (Base 64 > 6 bits > chunks of 24bit = 3 bytes)`);
        const chunks: number[] = [];
        for (let index = 0; index < data.length; index += 3) {
            // extract 4x 6 bit chunks from 3 bytes of data
            chunks.push(...
                [(data[index] & 0xfc) >> 2,
                ((data[index] & 0x03) << 4) | ((data[index + 1] & 0xf0) >> 4),
                ((data[index + 1] & 0x0f) << 2) | ((data[index + 2] & 0xc0) >> 6),
                (data[index + 2] & 0x3f)]);
        }
        return chunks.map(bitChunk => BASE64[bitChunk]).join('');
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

    static encodeNumber(number: number): string {
        // TODO could be base 64, not much saving though
        return number.toString(36);
    }

    static decodeNumber(number: string): number {
        // try { return parseInt(number, 36) } catch (e) { return 0 };
        return parseInt(number, 36);
    }

    static encodeAddress(address: Uint8Array): string {
        return this.base64Encode(address, true);
    }

    static decodeAddress(address: string): Uint8Array {
        return this.base64Decode(address, 20);
    }

    static encodePath(path: string): string {
        // "m/44'/242'/0'/0'" > var length, restricted character set
        // TODO m/ == constant?
        // > path.split("'/") > 4xFF
        return path;
    }

    static decodePath(path: string): string {
        // TODO
        return path;
    }

    static encodeId(hex: string): string {
        // example "1ee3d926a49c"
        if (hex.length != 12) throw new Error(`not a valid ID ${hex}`);
        const bytes = hex.split(/(.{2})/).filter(e => e != '').map(e => parseInt(e, 16));
        return this.base64Encode(Uint8Array.from(bytes));
    }
    static decodeId(code: string): string {
        const hex = Array.from(this.base64Decode(code)).map(n => n.toString(16)).join('');
        if (hex.length != 12) throw new Error(`not a valid ID ${hex}`);
        return hex;
    }

    static encodeAccount(account: AccountInfoEntry): string {
        const data = [
            [
                this.encodeAddress(account.address),
                this.encodePath(account.path),
            ].join(''),
            this.sanitizeString(account.label),
        ]
        if (account.balance) {
            data.push(this.encodeNumber(account.balance));
        }
        return data.join(Separator.ACCOUNT_ELEMENT);
    }

    static decodeAccount(accountData: string): AccountInfoEntry {
        const elements = accountData.split(Separator.ACCOUNT_ELEMENT);
        return {
            address: this.decodeAddress(elements[0].substr(0, 28)),
            path: this.decodePath(elements[0].substr(28)),
            label: elements[1],
            balance: (elements.length > 2) ? this.decodeNumber(elements[2]) : undefined,
        };
    }

    static compressAccounts(accountsMap: Map</*address*/ string, AccountInfoEntry>): string {
        return Array.from(accountsMap.values())
            .map(account => this.encodeAccount(account))
            .join(Separator.ACCOUNT);
    }

    static decodeAccounts(accounts: string): Map</*address*/ string, AccountInfoEntry> {
        const accountsMap = new Map</*address*/ string, AccountInfoEntry>();
        accounts
            .split(Separator.ACCOUNT)
            .forEach(encoded => {
                const account = this.decodeAccount(encoded);
                const address = new Nimiq.Address(account.address).toUserFriendlyAddress();
                accountsMap.set(address, account);
            });

        return accountsMap;
    }

    static encodeContractType(type: ContractType): string {
        return type.valueOf().toString(36);
    }

    static decodeContractType(type: string): ContractType {
        return <ContractType>parseInt(type, 36);
    }

    static encodeContract(contract: ContractInfo): string {
        return [
            `${this.encodeAddress(contract.address)}${this.encodeContractType(contract.type)}${this.sanitizeString(contract.label)}`,
            this.encodePath(contract.ownerPath),
        ].join(Separator.ACCOUNT_ELEMENT);
    }

    static decodeContract(contract: string): ContractInfo {
        const elements = contract.split(Separator.ACCOUNT_ELEMENT);
        return {
            address: this.decodeAddress(elements[0].substr(0, 28)),
            type: this.decodeContractType(elements[0].substr(28, 1)),
            label: this.sanitizeString(elements[0].substr(29)),
            ownerPath: this.decodePath(elements[1]),
        }
    }

    static encodeContracts(contracts: ContractInfo[]): string {
        return contracts
            .map(contract => this.encodeContract(contract))
            .join(Separator.ACCOUNT);
    }

    static decodeContracts(contracts: string): ContractInfo[] {
        return contracts
            .split(Separator.ACCOUNT)
            .filter(s => s.trim() != '')
            .map(contract => this.decodeContract(contract));
    }

    static encodeType(type: WalletType): string {
        return type.valueOf().toString(36);
    }

    static decodeType(type: string): WalletType {
        return <WalletType>parseInt(type, 36);
    }

    static encodeWallet(wallet: WalletInfoEntry): string {
        return [
            [
                this.encodeId(wallet.id),         // 8 characters
                this.encodeType(wallet.type),      // 1
                this.sanitizeString(wallet.label), // variable
            ].join(''),
            this.compressAccounts(wallet.accounts),
            this.encodeContracts(wallet.contracts),
        ].join(Separator.WALLET_ELEMENT);
    }

    static decodeWallet(wallet: string): WalletInfoEntry {
        const elements = wallet.split(Separator.WALLET_ELEMENT)
        return {
            id: this.decodeId(elements[0].substr(0, 8)),
            type: this.decodeType(elements[0].substr(8, 1)),
            label: elements[0].substr(9),
            accounts: this.decodeAccounts(elements[1]),
            contracts: this.decodeContracts(elements[2]),
        }
    }

    public static encodeWallets(wallets: WalletInfoEntry[]): string {
        return wallets
            .map(wallet => this.encodeWallet(wallet))
            .join(Separator.WALLET);
    }

    public static decodeWallets(wallets: string): WalletInfoEntry[] {
        return wallets.split(Separator.WALLET)
            .map(wallet => this.decodeWallet(wallet))
    }

    public static fill(wallets: WalletInfoEntry[]) {
        document.cookie = this.encodeWallets(wallets);
    }

    public static eat(): WalletInfoEntry[] {
        return this.decodeWallets(document.cookie);
    }

}
