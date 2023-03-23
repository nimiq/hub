import type { NimiqVersion as LedgerApiNimiqVersion } from '@nimiq/ledger-api'; // import type only to avoid bundling
import { NETWORK_TEST } from '../lib/Constants';
import { BTC_NETWORK_TEST, NATIVE_SEGWIT } from '../lib/bitcoin/BitcoinConstants';
import { POLYGON_NETWORK_TEST } from '../lib/polygon/PolygonConstants';

export default {
    keyguardEndpoint: process.env.VUE_APP_KEYGUARD_URL,
    ledgerApiNimiqVersion: 'legacy' as LedgerApiNimiqVersion.LEGACY,
    network: NETWORK_TEST,
    networkEndpoint: 'https://network.nimiq-testnet.com',
    privilegedOrigins: [
        process.env.VUE_APP_WALLET_URL,
        process.env.VUE_APP_HUB_URL, // For testing with the deployed demos.html page
    ],
    redirectTarget: process.env.VUE_APP_WALLET_URL,
    reportToSentry: false,
    checkoutWithoutNimOrigins: [
        'https://checkout-service-staging-0.web.app',
    ],

    enableBitcoin: false,
    bitcoinNetwork: BTC_NETWORK_TEST,
    bitcoinAddressType: NATIVE_SEGWIT,

    // enablePolygon: true,
    polygonNetwork: POLYGON_NETWORK_TEST,

    fastspot: {
        apiEndpoint: 'https://api.test.fastspot.io/fast/v1',
        apiKey: 'd011aeea-41cf-4c05-a31d-436495bed9b7',
    },

    oasis: {
        apiEndpoint: 'https://api-sandbox.nimiqoasis.com/v1',
    },
};
