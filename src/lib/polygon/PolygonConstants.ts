export const USDC_CENTS_PER_COIN = 1e6;

type PolygonNetworkType = 'TEST' | 'MAIN';
export const POLYGON_NETWORK_TEST: PolygonNetworkType = 'TEST'; // Mumbai
export const POLYGON_NETWORK_MAIN: PolygonNetworkType = 'MAIN';

// Will be extended in the Keyguard with `/0/0`
export const POLYGON_ACCOUNT_KEY_PATH = {
    MAIN: `m/44'/60'/0'`, // Ether's coin type, like all multicoin-wallets use
    TEST: `m/44'/699'/0'`,
} as const;
