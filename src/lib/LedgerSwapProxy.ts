import LedgerApi, { Coin, getBip32Path, parseBip32Path } from '@nimiq/ledger-api';
import { loadNimiq } from './Helpers';

export const LedgerSwapProxyExtraData = {
    // HTLC Proxy Funding, abbreviated as 'HPFD', mapped to values outside of basic ascii range
    FUND:  new Uint8Array([0, ...('HPFD'.split('').map((c) => c.charCodeAt(0) + 63))]),
    // HTLC Proxy Redeeming, abbreviated as 'HPRD', mapped to values outside of basic ascii range
    REDEEM: new Uint8Array([0, ...('HPRD'.split('').map((c) => c.charCodeAt(0) + 63))]),
};

const LEDGER_SWAP_PROXY_SALT_STORAGE_KEY = 'ledger-swap-proxy-salt';

export async function getLedgerSwapProxy(swapValidityStartHeight: number, ownerPath: string, ownerKeyId?: string) {
    const { addressIndex } = parseBip32Path(ownerPath);
    // Use a public key derived from the Ledger as part of the entropy to make access to the Ledger mandatory for
    // signing proxy transactions.
    const proxyKeyPath = getBip32Path({
        coin: Coin.NIMIQ,
        // Create a unique proxy per swap by factoring in the validity start height at the time of proxy funding and
        // the address index of the proxy owning Ledger address. Go from the maximum index allowed by bip32.
        accountIndex: 2 ** 31 - 1 - swapValidityStartHeight,
        addressIndex: 2 ** 31 - 1 - addressIndex,
    });
    const [entropySourcePublicKey] = await Promise.all([
        LedgerApi.Nimiq.getPublicKey(proxyKeyPath, ownerKeyId),
        loadNimiq(),
    ]);

    if (!localStorage[LEDGER_SWAP_PROXY_SALT_STORAGE_KEY]) {
        // generate a 32 byte random salt
        localStorage[LEDGER_SWAP_PROXY_SALT_STORAGE_KEY] = Nimiq.BufferUtils.toBase64(
            Nimiq.PrivateKey.generate().serialize());
    }
    let salt: Uint8Array;
    try {
        salt = Nimiq.BufferUtils.fromBase64(
            localStorage[LEDGER_SWAP_PROXY_SALT_STORAGE_KEY],
            Nimiq.PrivateKey.SIZE,
        );
    } catch (e) {
        throw new Error(`Failed to read random salt from local storage: ${e.message || e}`);
    }

    const saltedEntropySource = new Uint8Array(entropySourcePublicKey.serializedSize + salt.length);
    saltedEntropySource.set(entropySourcePublicKey.serialize(), 0);
    saltedEntropySource.set(salt, entropySourcePublicKey.serializedSize);
    const nimProxyEntropy = Nimiq.Hash.computeBlake2b(saltedEntropySource);
    return Nimiq.KeyPair.derive(new Nimiq.PrivateKey(nimProxyEntropy));
}

export async function getLegacyLedgerSwapProxy(ownerPath: string, ownerKeyId?: string) {
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
