import LedgerApi, { Coin, getBip32Path, parseBip32Path } from '@nimiq/ledger-api';
import { loadNimiq } from './Helpers';

export const LedgerSwapProxyExtraData = {
    // HTLC Proxy Funding, abbreviated as 'HPFD', mapped to values outside of basic ascii range
    FUND:  new Uint8Array([0, ...('HPFD'.split('').map((c) => c.charCodeAt(0) + 63))]),
    // HTLC Proxy Redeeming, abbreviated as 'HPRD', mapped to values outside of basic ascii range
    REDEEM: new Uint8Array([0, ...('HPRD'.split('').map((c) => c.charCodeAt(0) + 63))]),
};

export async function getLedgerSwapProxy(ownerPath: string, ownerKeyId?: string) {
    const { addressIndex } = parseBip32Path(ownerPath);
    const proxyKeyPath = getBip32Path({
        coin: Coin.NIMIQ,
        accountIndex: 2 ** 31 - 1, // max index allowed by bip32
        addressIndex: 2 ** 31 - 1 - addressIndex, // use a distinct proxy per address for improved privacy
    });
    const [entropySourcePublicKey] = await Promise.all([
        LedgerApi.Nimiq.getPublicKey(proxyKeyPath, ownerKeyId),
        loadNimiq(),
    ]);

    return Nimiq.KeyPair.derive(new Nimiq.PrivateKey(entropySourcePublicKey.serialize()));
}
