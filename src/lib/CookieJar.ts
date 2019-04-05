// tslint:disable no-bitwise no-shadowed-variable

import { WalletInfoEntry, WalletType } from './WalletInfo';
import { Utf8Tools } from '@nimiq/utils';
import {
    LABEL_MAX_LENGTH,
    ACCOUNT_DEFAULT_LABEL_LEDGER,
    CONTRACT_DEFAULT_LABEL_VESTING,
    CONTRACT_DEFAULT_LABEL_HTLC,
} from '@/lib/Constants';
import LabelingMachine from './LabelingMachine';
import { ContractInfoEntry, VestingContractInfoEntry, VestingContractInfo } from './ContractInfo';

class CookieJar {
    public static readonly VERSION = 1;
    public static readonly MAX_COOKIE_SIZE = 2500; // byte (3000 would probable be safe, but we'll be safer for now)

    public static readonly ENCODED_ACCOUNT_SIZE =
           1 // account label length
        + 63 // account label
        + 20 // address
    ;

    public static fill(wallets: WalletInfoEntry[]) {
        const maxAge = 60 * 60 * 24 * 365; // 1 year
        const encodedWallets = this.encodeCookie(wallets);
        // Add 'Secure;' if we are not in a test environment
        const secure = location.protocol === 'https:' ? 'Secure;' : '';
        document.cookie = `w=${encodedWallets};max-age=${maxAge.toString()};${secure}SameSite=strict`;
    }

    public static async eat(): Promise<WalletInfoEntry[]> {
        const encodedWallets = this.getCookieContents();
        return encodedWallets ? this.decodeCookie(encodedWallets) : [];
    }

    public static encodeCookie(wallets: WalletInfoEntry[]) {
        const bytes: number[] = [];

        // Cookie version
        bytes.push(CookieJar.VERSION);

        for (const wallet of wallets) {
            bytes.push.apply(bytes, this.encodeWallet(wallet));
        }

        return Nimiq.BufferUtils.toBase64(new Uint8Array(bytes));
    }

    public static async decodeCookie(str: string): Promise<WalletInfoEntry[]> {
        const module = await import(/* webpackChunkName: "cookie-decoder" */ './CookieDecoder');
        return module.CookieDecoder.decode(str);
    }

    public static canFitNewAccount(): boolean {
        return (this.MAX_COOKIE_SIZE - this.getCookieSize()) >= this.ENCODED_ACCOUNT_SIZE;
    }

    public static canFitNewWallet(wallet: WalletInfoEntry): boolean {
        return (this.MAX_COOKIE_SIZE - this.getCookieSize()) >= this.encodeWallet(wallet).length;
    }

    public static encodeAndcutLabel(label: string): Uint8Array {
        let labelBytes = Utf8Tools.stringToUtf8ByteArray(label);

        if (labelBytes.length <= LABEL_MAX_LENGTH) return labelBytes;

        // Don't output warning in NodeJS environment (when running tests)
        if (typeof global === 'undefined') console.warn('Label will be shortened for cookie:', label);

        labelBytes = labelBytes.slice(0, LABEL_MAX_LENGTH);

        // Cut off last byte until byte array is valid utf-8
        while (!Utf8Tools.isValidUtf8(labelBytes)) labelBytes = labelBytes.slice(0, labelBytes.length - 1);
        return labelBytes;
    }

    private static checkWalletDefaultLabel(firstAddress: Uint8Array, label: string, type: WalletType): string {
        if (type === WalletType.LEDGER) {
            if (label === ACCOUNT_DEFAULT_LABEL_LEDGER) return '';
            return label;
        }

        const userFriendlyAddress = new Nimiq.Address(firstAddress).toUserFriendlyAddress();
        const defaultLabel = LabelingMachine.labelAccount(userFriendlyAddress);
        if (label === defaultLabel) return '';
        return label;
    }

    private static checkAccountDefaultLabel(address: Uint8Array, label: string): string {
        const userFriendlyAddress = new Nimiq.Address(address).toUserFriendlyAddress();
        const defaultLabel = LabelingMachine.labelAddress(userFriendlyAddress);
        if (label === defaultLabel) return '';
        return label;
    }

    private static checkContractDefaultLabel(type: Nimiq.Account.Type, label: string): string {
        switch (type) {
            case Nimiq.Account.Type.VESTING: return label === CONTRACT_DEFAULT_LABEL_VESTING ? '' : label;
            case Nimiq.Account.Type.HTLC: return label === CONTRACT_DEFAULT_LABEL_HTLC ? '' : label;
            default: return label;
        }
    }

    private static encodeWallet(wallet: WalletInfoEntry) {
        const bytes: number[] = [];

        // The check<Account|Wallet>DefaultLabel functions omit the label when it's the default label
        const firstAccount = wallet.accounts.values().next().value;
        const label = wallet.type === WalletType.LEGACY
            ? this.checkAccountDefaultLabel(
                firstAccount.address,
                firstAccount.label,
            )
            : this.checkWalletDefaultLabel(
                firstAccount.address,
                wallet.label,
                wallet.type,
            );

        const labelBytes = this.encodeAndcutLabel(label);

        // Combined label length & wallet type
        bytes.push((labelBytes.length << 2) | wallet.type);

        // Status
        let statusByte: number = 0;
        statusByte = statusByte
                | (wallet.keyMissing ? CookieJar.StatusFlags.KEY_MISSING : CookieJar.StatusFlags.NONE)
                | (wallet.fileExported ? CookieJar.StatusFlags.FILE_EXPORTED : CookieJar.StatusFlags.NONE)
                | (wallet.wordsExported ? CookieJar.StatusFlags.WORDS_EXPORTED : CookieJar.StatusFlags.NONE)
                | (wallet.contracts.length ? CookieJar.StatusFlags.HAS_CONTRACTS : CookieJar.StatusFlags.NONE)
        ;
        bytes.push(statusByte);

        // Wallet ID
        if (wallet.type === WalletType.LEDGER) {
            const walletIdChunks = wallet.id.match(/.{2}/g);
            for (const chunk of walletIdChunks!) {
                bytes.push(parseInt(chunk, 16));
            }
        } else {
            // Keyguard Wallet
            const numericalId = parseInt(wallet.id.substr(1), 10);
            const idBytes = CookieJar.toBase256(numericalId);
            bytes.push(idBytes.length);
            bytes.push.apply(bytes, idBytes);
        }

        // Label
        bytes.push.apply(bytes, Array.from(labelBytes));

        // Legacy account information
        if (wallet.type === WalletType.LEGACY) {
            const account = wallet.accounts.values().next().value;

            // Account address
            bytes.push.apply(bytes, Array.from(account.address));

            this.encodeContracts(wallet.contracts, bytes);

            return bytes;
        }

        // Regular label and account information

        // Wallet number of accounts
        bytes.push(wallet.accounts.size);

        // Wallet accounts
        const accounts = Array.from(wallet.accounts.values());
        for (const account of accounts) {
            const label = this.checkAccountDefaultLabel(account.address, account.label);
            const labelBytes = this.encodeAndcutLabel(label);

            // Account label length
            bytes.push(labelBytes.length);

            // Account label
            bytes.push.apply(bytes, Array.from(labelBytes));

            // Account address
            bytes.push.apply(bytes, Array.from(account.address));
        }

        this.encodeContracts(wallet.contracts, bytes);

        return bytes;
    }

    private static encodeContracts(contracts: ContractInfoEntry[], bytes: number[]) {
        if (!contracts.length) return;

        bytes.push(contracts.length);

        for (const contract of contracts) {
            const label = this.checkContractDefaultLabel(contract.type, contract.label);
            const labelBytes = this.encodeAndcutLabel(label);

            // Combined contract label length and type
            bytes.push((labelBytes.length << 2) | contract.type);

            // Contract label
            bytes.push.apply(bytes, Array.from(labelBytes));

            // Contract address
            bytes.push.apply(bytes, Array.from(contract.address));

            switch (contract.type) {
                case Nimiq.Account.Type.VESTING:
                    const data = contract as VestingContractInfoEntry;
                    bytes.push.apply(bytes, Array.from(data.owner));
                    bytes.push.apply(bytes, this.toBase256(data.start, 4)); // Uint32
                    bytes.push.apply(bytes, this.toBase256(data.stepAmount, 8)); // Uint64
                    bytes.push.apply(bytes, this.toBase256(data.stepBlocks, 4)); // Uint32
                    bytes.push.apply(bytes, this.toBase256(data.totalAmount, 8)); // Uint64
                    break;
                case Nimiq.Account.Type.HTLC:
                    throw new Error('HTLC encoding is not yet implemented');
                default:
                    // @ts-ignore Property 'type' does not exist on type 'never'.
                    throw new Error('Unknown contract type: ' + contract.type);
            }
        }
    }

    private static getCookieContents(): string | null {
        const match = document.cookie.match(new RegExp('w=([^;]+)'));
        return match && match[1];
    }

    private static getCookieSize(): number {
        const encodedWallets = this.getCookieContents() || '';
        return Nimiq.BufferUtils.fromBase64(encodedWallets).length;
    }

    private static toBase256(value: number, padToBytes?: number) {
        let bits = value.toString(2);

        if (padToBytes) {
            bits = bits.padStart(padToBytes * 8, '0');
        }

        // Reverse so we can split into 8s from the end
        const reverseBits = bits.split('').reverse().join('');

        // Split into chunks of 8 bits
        const reverseBytes = reverseBits.match(/.{1,8}/g) as RegExpMatchArray;

        // Reverse chunks, parse as base2 int, reverse array
        const bytes = reverseBytes.map((revByte) => parseInt(revByte.split('').reverse().join(''), 2)).reverse();
        return bytes;
    }
}

namespace CookieJar { // tslint:disable-line no-namespace
    export enum StatusFlags {
        NONE           = 0,
        KEY_MISSING    = 1 << 0,
        FILE_EXPORTED  = 1 << 1,
        WORDS_EXPORTED = 1 << 2,
        HAS_CONTRACTS  = 1 << 3,
    }
}

export default CookieJar;
