import { WalletInfo, WalletInfoEntry, WalletType } '@/lib/WalletInfo';
import { AccountInfoEntry } from '@/lib/AccountInfo';
import { ContractInfo } from '/ContractInfo';

enum Separator {
    ACCOUNT_ELEMENT = '︙',
    ACCOUNT = '⸾',
    WALLET_ELEMENT = '⸽',
    WALLET = '⸻',
}

const BASE64 =
//   0       8       16      24      32      40      48      56     63
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+-";

export class CookieJar {

    private static sanitizeString(string: string): string {
        for (const separator in Separator) {
            string = string.replace(separator, '');
        }
        return string;
    }

    private static base64Encode(data: Uint8Array): string{
        if(data.length % 3 != 0) throw new Error('Can only compress multiples of 3 (Base 64 > 6 bits > chunks of 24bit = 3 bytes)');
        const chunks: number[] = [];
        for (let index = 0; index < data.length; index += 3) {
            // extract 4x 6 bit chunks from 3 bytes of data
            chunks.push(...
                [(data[index] & 0xfc) >> 2,
                ((data[index] & 0x03) << 4) | ((data[index + 1] & 0x0f) >> 4),
                ((data[index + 1] & 0x0f) << 4) | ((data[index + 2] & 0xc0) >> 6),
                (data[index + 2] & 0x3f)]);
        }
        return chunks.map(bitChunk => BASE64[bitChunk]).join();
    }

    private static compressNumber(number: number): string{
        throw "not implemented"
    }

    private static compressPath(path: string): string{
        // "m/44'/242'/0'/0'" > var length, restricted character set
        // TODO m/ == constant?
        // > path.split("'/") > 4xFF
        return path;
    }

    private static compressId(hex: string): string{
        // example "1ee3d926a49c"
        if (hex.length != 6) throw new Error('not a valid ID');
        const bytes = hex.split(/(.{2})/).filter(e => e != '').map(e => parseInt(e, 16));
        return this.base64Encode(Uint8Array.from(bytes));
    }

    private static compressAccount(account: AccountInfoEntry): string {
        const data = [
            this.base64Encode(account.address),
            this.compressPath(account.path),
            this.sanitizeString(account.label),
        ]
        if (account.balance) {
            data.push(this.compressNumber(account.balance));
        }
        return data.join(Separator.ACCOUNT_ELEMENT);
    }

    private static compressAccounts(accountsMap: Map</*address*/ string, AccountInfoEntry>): string {
        return Array.from(accountsMap.values())
            .map(account => this.compressAccount(account))
            .join(Separator.ACCOUNT);
    }

    private static compressContracts(contracts: ContractInfo[]): string {
        throw "not implemented";
    }

    private static compressType(type: WalletType): string {
        // TODO compress!
        return WalletType[type].toString();
    }

    private static compressWallet(wallet: WalletInfoEntry): string {
        const data = [
            `${this.compressId(wallet.id)}${this.compressType(wallet.type)}${this.sanitizeString(wallet.label)}`,
            this.compressAccounts(wallet.accounts),
            this.compressContracts(wallet.contracts),
        ];
        return data.join(Separator.WALLET_ELEMENT);
    }

    public static fill(wallets: WalletInfoEntry[]) {
        return wallets
            .map(wallet => this.compressWallet(wallet))
            .join(Separator.WALLET);
    }

}
