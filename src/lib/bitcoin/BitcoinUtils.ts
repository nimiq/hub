import Config from 'config';
import {
    bip32 as BitcoinJs_bip32,
    networks as BitcoinJs_networks,
    payments as BitcoinJs_payments,
} from 'bitcoinjs-lib';
import type { Network as BitcoinJs_Network, BIP32Interface as BitcoinJs_Bip32Interface } from 'bitcoinjs-lib';
import {
    BTC_NETWORK_MAIN,
    BTC_NETWORK_TEST,
    NESTED_SEGWIT,
    NATIVE_SEGWIT,
    SATOSHIS_PER_COIN,
    EXTENDED_KEY_PREFIXES,
    BTC_ACCOUNT_KEY_PATH,
    BTC_ACCOUNT_MAX_ALLOWED_ADDRESS_GAP,
} from './BitcoinConstants';
import { BtcAddressInfo } from './BtcAddressInfo';
import type {
    BitcoinTransactionChangeOutput,
    BitcoinTransactionInfo as KeyguardBitcoinTransactionInfo,
} from '@nimiq/keyguard-client';

// BitcoinTransactionInfo with complete changeOutput
export type BitcoinTransactionInfo = Omit<KeyguardBitcoinTransactionInfo, 'changeOutput'> & {
    changeOutput?: Required<BitcoinTransactionChangeOutput>,
};

export function getBtcNetwork(addressType = Config.bitcoinAddressType) {
    let network: BitcoinJs_Network;
    switch (Config.bitcoinNetwork) {
        case BTC_NETWORK_MAIN:
            network = BitcoinJs_networks.bitcoin;
            break;
        case BTC_NETWORK_TEST:
            network = BitcoinJs_networks.testnet;
            break;
        default:
            throw new Error('Invalid bitcoinNetwork configuration');
    }

    return {
        ...network,
        // Adjust the first bytes of xpubs to the respective BIP we are using, to ensure correct xpub parsing
        bip32: EXTENDED_KEY_PREFIXES[addressType][Config.bitcoinNetwork],
    };
}

export function publicKeyToPayment(publicKey: Buffer, addressType = Config.bitcoinAddressType) {
    switch (addressType) {
        case NESTED_SEGWIT:
            return BitcoinJs_payments.p2sh({
                redeem: BitcoinJs_payments.p2wpkh({
                    pubkey: publicKey,
                    network: getBtcNetwork(),
                }),
            });
        case NATIVE_SEGWIT:
            return BitcoinJs_payments.p2wpkh({
                pubkey: publicKey,
                network: getBtcNetwork(),
            });
        default:
            throw new Error('Invalid address type');
    }
}

export function satoshisToCoins(satoshis: number) {
    return satoshis / SATOSHIS_PER_COIN;
}

export function deriveAddressesFromXPub(
    xpub: BitcoinJs_Bip32Interface | string,
    derivationPath: number[],
    startIndex = 0,
    count = BTC_ACCOUNT_MAX_ALLOWED_ADDRESS_GAP,
    addressType = Config.bitcoinAddressType,
): BtcAddressInfo[] {
    let extendedKey: BitcoinJs_Bip32Interface;
    if (typeof xpub === 'string') {
        const network = getBtcNetwork(addressType);
        extendedKey = BitcoinJs_bip32.fromBase58(xpub, network);
    } else {
        extendedKey = xpub;
    }

    let baseKey = extendedKey;
    for (const index of derivationPath) {
        baseKey = baseKey.derive(index);
    }

    const path = BTC_ACCOUNT_KEY_PATH[addressType][Config.bitcoinNetwork]
        + (derivationPath.length > 0 ? '/' : '')
        + derivationPath.join('/');

    const addresses: BtcAddressInfo[] = [];

    for (let i = startIndex; i < startIndex + count; i++) {
        const pubKey = baseKey.derive(i).publicKey;

        const address = publicKeyToPayment(pubKey, addressType).address;
        if (!address) throw new Error(`Cannot create external address for ${extendedKey.toBase58()} index ${i}`);

        addresses.push(new BtcAddressInfo(
            `${path}/${i}`,
            address,
            false,
        ));
    }

    return addresses;
}
