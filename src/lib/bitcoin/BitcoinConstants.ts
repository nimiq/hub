
export const BTC_ACCOUNT_DERIVATION_PATH = {
    BIP49: {
        MAIN: `m/49'/0'/0'`,
        TEST: `m/49'/1'/0'`,
    },
    BIP84: {
        MAIN: `m/84'/0'/0'`,
        TEST: `m/84'/1'/0'`,
    },
};

export const BTC_ACCOUNT_MAX_ALLOWED_ADDRESS_GAP = 20;

export const SATOSHIS_PER_COIN = 1e8;

type BtcNetworkType = 'test' | 'main';
export const BTC_NETWORK_TEST: BtcNetworkType = 'test';
export const BTC_NETWORK_MAIN: BtcNetworkType = 'main';

export const BIP = {
    BIP49: 'BIP49' as 'BIP49', // Nested SegWit
    BIP84: 'BIP84' as 'BIP84', // Native SegWit
};
