export const SATOSHIS_PER_COIN = 1e8;

type BtcAddressType = 'BIP49' | 'BIP84';
export const BIP49: BtcAddressType = 'BIP49'; // Nested SegWit
export const BIP84: BtcAddressType = 'BIP84'; // Native SegWit
export const NESTED_SEGWIT: BtcAddressType = BIP49;
export const NATIVE_SEGWIT: BtcAddressType = BIP84;

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

export const BTC_ACCOUNT_MAX_ALLOWED_ADDRESS_GAP = 5; // FIXME: Set to the standard 20 after testing

// https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki#change
export const EXTERNAL_INDEX = 0;
export const INTERNAL_INDEX = 1;

export const EXTENDED_KEY_PREFIXES = {
    // See https://github.com/satoshilabs/slips/blob/master/slip-0132.md#registered-hd-version-bytes
    BIP49: {
        MAIN: {
            public: 0x049d7cb2, // ypub
            private: 0x049d7878, // yprv
        },
        TEST: {
            public: 0x044a5262, // upub
            private: 0x044a4e28, // uprv
        },
    },
    BIP84: {
        MAIN: {
            public: 0x04b24746, // zpub
            private: 0x04b2430c, // zprv
        },
        TEST: {
            public: 0x045f1cf6, // vpub
            private: 0x045f18bc, // vprv
        },
    },
};

export const BIP49_ADDRESS_VERSIONS = {
    // See https://en.bitcoin.it/wiki/List_of_address_prefixes
    MAIN: [0, 5],
    TEST: [111, 196],
};

export const BIP84_ADDRESS_PREFIX = {
    // See https://en.bitcoin.it/wiki/List_of_address_prefixes
    MAIN: 'bc',
    TEST: 'tb',
};
