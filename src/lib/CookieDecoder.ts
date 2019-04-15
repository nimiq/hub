// tslint:disable no-bitwise no-shadowed-variable

import { WalletInfoEntry, WalletType } from './WalletInfo';
import { Utf8Tools } from '@nimiq/utils';
import { AccountInfoEntry } from './AccountInfo';
import CookieJar from './CookieJar';
import {
    ACCOUNT_DEFAULT_LABEL_LEGACY,
    ACCOUNT_DEFAULT_LABEL_LEDGER,
    LABEL_MAX_LENGTH,
    CONTRACT_DEFAULT_LABEL_VESTING,
} from '@/lib/Constants';
import LabelingMachine from './LabelingMachine';
import { ContractInfoEntry, VestingContractInfoEntry } from './ContractInfo';
import AddressUtils from './AddressUtils';

export class CookieDecoder {
    public static decode(str: string): WalletInfoEntry[] {
        if (!str) return [];

        // Convert base64 str into byte array
        const bytes: number[] = Array.from(this.base64Decode(str));

        // Cookie version
        const version = this.readByte(bytes);

        if (version !== CookieJar.VERSION) return this.legacyCookie(version, bytes);

        const wallets: WalletInfoEntry[] = [];
        while (bytes.length > 0) {
            wallets.push(this.decodeWallet(bytes));
        }

        return wallets;
    }

    private static readByte(bytes: number[]): number {
        const byte = bytes.shift();
        if (typeof byte === 'undefined') throw new Error('Malformed Cookie');
        return byte;
    }

    private static readBytes(bytes: number[], length: number): number[] {
        const result: number[] = [];
        for (let i = 0; i < length; i++) {
            result.push(this.readByte(bytes));
        }
        return result;
    }

    private static decodeWallet(bytes: number[]): WalletInfoEntry {
        // Wallet type and label length
        const typeAndLabelLength = this.readByte(bytes);
        const type = typeAndLabelLength & 0b11;
        const labelLength = typeAndLabelLength >> 2; // Can only be < 64 because it's only 6 bit

        // Status byte
        const statusByte = this.readByte(bytes);
        const keyMissing =
            (statusByte & CookieJar.StatusFlags.KEY_MISSING) === CookieJar.StatusFlags.KEY_MISSING;
        const fileExported =
            (statusByte & CookieJar.StatusFlags.FILE_EXPORTED) === CookieJar.StatusFlags.FILE_EXPORTED;
        const wordsExported =
            (statusByte & CookieJar.StatusFlags.WORDS_EXPORTED) === CookieJar.StatusFlags.WORDS_EXPORTED;
        const hasContracts =
            (statusByte & CookieJar.StatusFlags.HAS_CONTRACTS) === CookieJar.StatusFlags.HAS_CONTRACTS;

        // Wallet ID
        let id: string = '';
        for (let i = 0; i < 6; i++) {
            const idChunk = this.readByte(bytes).toString(16);
            id += `${idChunk.length < 2 ? '0' : ''}${idChunk}`;
        }

        // Handle LEGACY wallet
        if (type === WalletType.LEGACY) {
            const walletLabel = ACCOUNT_DEFAULT_LABEL_LEGACY;

            const accounts = this.decodeAccounts(bytes, labelLength);

            const contracts = hasContracts ? this.decodeContracts(bytes) : [];

            const walletInfoEntry: WalletInfoEntry = {
                id,
                keyId: '',
                type,
                label: walletLabel,
                accounts,
                contracts,
                keyMissing,
                fileExported,
                wordsExported,
            };

            return walletInfoEntry;
        }

        // Handle regular wallet

        // Wallet label
        const walletLabelBytes = this.readBytes(bytes, labelLength);

        const accounts = this.decodeAccounts(bytes);

        const contracts = hasContracts ? this.decodeContracts(bytes) : [];

        const firstAccount = accounts.values().next().value;
        const walletLabel = walletLabelBytes.length > 0
            ? Utf8Tools.utf8ByteArrayToString(new Uint8Array(walletLabelBytes))
            : type === WalletType.LEDGER
                ? ACCOUNT_DEFAULT_LABEL_LEDGER
                : LabelingMachine.labelAccount(AddressUtils.toUserFriendlyAddress(firstAccount.address));

        const walletInfoEntry: WalletInfoEntry = {
            id,
            keyId: '',
            type,
            label: walletLabel,
            accounts,
            contracts,
            keyMissing,
            fileExported,
            wordsExported,
        };

        return walletInfoEntry;
    }

    private static decodeAccounts(bytes: number[], labelLength?: number): Map<string, AccountInfoEntry> {
        let numberAccounts = 1;
        if (typeof labelLength === 'undefined') {
            // When the labelLength is not passed, it means it is not a LEGACY wallet
            // and the number of accounts is encoded before the list
            numberAccounts = this.readByte(bytes);
        }

        const accounts: AccountInfoEntry[] = [];
        for (let i = 0; i < numberAccounts; i++) {
            accounts.push(this.decodeAccount(bytes, labelLength));
        }

        const accountsMapArray: Array<[string, AccountInfoEntry]> = accounts.map((account) => {
            // Deserialize Nimiq.Address
            const userFriendlyAddress = AddressUtils.toUserFriendlyAddress(account.address);

            return [userFriendlyAddress, account] as [string, AccountInfoEntry];
        });

        return new Map(accountsMapArray);
    }

    private static decodeAccount(bytes: number[], labelLength?: number): AccountInfoEntry {
        if (typeof labelLength === 'undefined') {
            labelLength = this.readByte(bytes);
        }

        if (labelLength > LABEL_MAX_LENGTH) {
            throw new Error('Malformed Cookie, label too long');
        }

        // Account label
        const labelBytes = this.readBytes(bytes, labelLength);

        // Account address
        // (iframe does not have Nimiq lib)
        const addressBytes = this.readBytes(bytes, 20 /* Nimiq.Address.SERIALIZED_SIZE */);

        const accountLabel = labelBytes.length > 0
            ? Utf8Tools.utf8ByteArrayToString(new Uint8Array(labelBytes))
            : LabelingMachine.labelAddress(AddressUtils.toUserFriendlyAddress(new Uint8Array(addressBytes)));

        const accountInfoEntry: AccountInfoEntry = {
            path: 'not public',
            label: accountLabel,
            address: new Uint8Array(addressBytes),
        };

        return accountInfoEntry;
    }

    private static decodeContracts(bytes: number[]): ContractInfoEntry[] {
        const numberContracts = this.readByte(bytes);

        const contracts: ContractInfoEntry[] = [];
        for (let i = 0; i < numberContracts; i++) {
            contracts.push(this.decodeContract(bytes));
        }

        return contracts;
    }

    private static decodeContract(bytes: number[]): ContractInfoEntry {
        // Contract type and label length
        const typeAndLabelLength = this.readByte(bytes);
        const type = typeAndLabelLength & 0b11;
        const labelLength = typeAndLabelLength >> 2;

        const labelBytes = this.readBytes(bytes, labelLength);

        // Contract address
        // (iframe does not have Nimiq lib)
        const addressBytes = this.readBytes(bytes, 20 /* Nimiq.Address.SERIALIZED_SIZE */);

        switch (type) {
            case 1 /* Nimiq.Account.Type.VESTING */:
                const label = labelBytes.length > 0
                    ? Utf8Tools.utf8ByteArrayToString(new Uint8Array(labelBytes))
                    : CONTRACT_DEFAULT_LABEL_VESTING;
                const ownerBytes = this.readBytes(bytes, 20 /* Nimiq.Address.SERIALIZED_SIZE */);
                const start = this.fromBase256(this.readBytes(bytes, 4)); // Uint32
                const stepAmount = this.fromBase256(this.readBytes(bytes, 8)); // Uint64
                const stepBlocks = this.fromBase256(this.readBytes(bytes, 4)); // Uint32
                const totalAmount = this.fromBase256(this.readBytes(bytes, 8)); // Uint64
                return {
                    type,
                    label,
                    address: new Uint8Array(addressBytes),
                    owner: new Uint8Array(ownerBytes),
                    start,
                    stepAmount,
                    stepBlocks,
                    totalAmount,
                } as VestingContractInfoEntry;
            case 2 /* Nimiq.Account.Type.HTLC */:
                throw new Error('HTLC decoding is not yet implemented');
            default:
                throw new Error('Unknown contract type: ' + type);
        }
    }

    private static legacyCookie(version: number, bytes: number[]): WalletInfoEntry[] {
        switch (version) {
            default: return [];
        }
    }

    private static fromBase256(numbers: number[]) {
        const base2bytes = numbers.map((value) => value.toString(2).padStart(8, '0'));

        return parseInt(base2bytes.join(''), 2);
    }

    private static base64Decode(base64: string): Uint8Array {
        /*
        Source: https://github.com/danguer/blog-examples/blob/master/js/base64-binary.js

        Copyright (c) 2011, Daniel Guerrero
        All rights reserved.

        Redistribution and use in source and binary forms, with or without
        modification, are permitted provided that the following conditions are met:
            * Redistributions of source code must retain the above copyright
            notice, this list of conditions and the following disclaimer.
            * Redistributions in binary form must reproduce the above copyright
            notice, this list of conditions and the following disclaimer in the
            documentation and/or other materials provided with the distribution.

        THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
        ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
        WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
        DISCLAIMED. IN NO EVENT SHALL DANIEL GUERRERO BE LIABLE FOR ANY
        DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
        (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
        LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
        ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
        (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
        SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
        */

        // Use a lookup table to find the index.
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        const lookup = new Uint8Array(256);
        for (let i = 0; i < chars.length; i++) {
            lookup[chars.charCodeAt(i)] = i;
        }

        // Decode
        let bufferLength = base64.length * 0.75;
        let p = 0;
        let encoded1: number;
        let encoded2: number;
        let encoded3: number;
        let encoded4: number;

        if (base64[base64.length - 1] === '=') {
            bufferLength--;
            if (base64[base64.length - 2] === '=') {
                bufferLength--;
            }
        }

        const bytes = new Uint8Array(bufferLength);

        for (let i = 0; i < base64.length; i += 4) {
            encoded1 = lookup[base64.charCodeAt(i)];
            encoded2 = lookup[base64.charCodeAt(i + 1)];
            encoded3 = lookup[base64.charCodeAt(i + 2)];
            encoded4 = lookup[base64.charCodeAt(i + 3)];

            bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
            bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
            bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
        }

        return bytes;
    }
}
