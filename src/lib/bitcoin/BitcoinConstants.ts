export const SATOSHIS_PER_COIN = 1e8;

export const BIP49: 'BIP49' = 'BIP49'; // Nested SegWit
export const BIP84: 'BIP84' = 'BIP84'; // Native SegWit
export const NESTED_SEGWIT = BIP49;
export const NATIVE_SEGWIT = BIP84;

type BtcNetworkType = 'TEST' | 'MAIN';
export const BTC_NETWORK_TEST: BtcNetworkType = 'TEST';
export const BTC_NETWORK_MAIN: BtcNetworkType = 'MAIN';

export const BTC_ACCOUNT_KEY_PATH = {
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
