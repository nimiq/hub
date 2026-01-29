import Config from 'config';
import type { Network as BitcoinJsNetwork, BIP32Interface as BitcoinJsBip32Interface } from 'bitcoinjs-lib';
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

export async function getBtcNetwork(addressType = Config.bitcoinAddressType) {
    const networks = await import('bitcoinjs-lib/src/networks');
    let network: BitcoinJsNetwork;
    switch (Config.bitcoinNetwork) {
        case BTC_NETWORK_MAIN:
            network = networks.bitcoin;
            break;
        case BTC_NETWORK_TEST:
            network = networks.testnet;
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

export async function publicKeyToPayment(publicKey: Buffer, addressType = Config.bitcoinAddressType) {
    const [
        { p2sh, p2wpkh },
        network,
    ] = await Promise.all([
        import('bitcoinjs-lib/src/payments'),
        getBtcNetwork(),
    ] as const);
    switch (addressType) {
        case NESTED_SEGWIT:
            return p2sh({
                redeem: p2wpkh({
                    pubkey: publicKey,
                    network,
                }),
            });
        case NATIVE_SEGWIT:
            return p2wpkh({
                pubkey: publicKey,
                network,
            });
        default:
            throw new Error('Invalid address type');
    }
}

export function satoshisToCoins(satoshis: number) {
    return satoshis / SATOSHIS_PER_COIN;
}

export async function deriveAddressesFromXPub(
    xpub: BitcoinJsBip32Interface | string,
    derivationPath: number[],
    startIndex = 0,
    count = BTC_ACCOUNT_MAX_ALLOWED_ADDRESS_GAP,
    addressType = Config.bitcoinAddressType,
): Promise<BtcAddressInfo[]> {
    let extendedKey: BitcoinJsBip32Interface;
    if (typeof xpub === 'string') {
        const [
            { fromBase58: bip32FromBase58 },
            network,
        ] = await Promise.all([
            import('bip32'),
            getBtcNetwork(addressType),
        ] as const);
        extendedKey = bip32FromBase58(xpub, network);
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

    const addressPromises: Array<Promise<BtcAddressInfo>> = [];

    for (let i = startIndex; i < startIndex + count; i++) {
        const pubKey = baseKey.derive(i).publicKey;

        const addressPromise = publicKeyToPayment(pubKey, addressType).then(({ address }) => {
            if (!address) throw new Error(`Cannot create external address for ${extendedKey.toBase58()} index ${i}`);
            return new BtcAddressInfo(
                `${path}/${i}`,
                address,
                false,
            );
        });

        addressPromises.push(addressPromise);
    }

    return Promise.all(addressPromises);
}
