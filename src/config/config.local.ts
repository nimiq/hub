import type { NimiqVersion as LedgerApiNimiqVersion } from '@nimiq/ledger-api'; // import type only to avoid bundling
import { NETWORK_TEST } from '../lib/Constants';
import { BTC_NETWORK_TEST, NATIVE_SEGWIT } from '../lib/bitcoin/BitcoinConstants';
import { POLYGON_NETWORK_TEST } from '../lib/polygon/PolygonConstants';

export default {
    keyguardEndpoint: window.location.protocol + '//' + window.location.hostname + ':8000/src',
    ledgerApiNimiqVersion: 'albatross' as LedgerApiNimiqVersion.ALBATROSS,
    network: NETWORK_TEST,
    nimiqNetworkId: 5,
    seedNodes: [
        '/dns4/seed1.pos.nimiq-testnet.com/tcp/8443/wss',
        '/dns4/seed2.pos.nimiq-testnet.com/tcp/8443/wss',
        '/dns4/seed3.pos.nimiq-testnet.com/tcp/8443/wss',
        '/dns4/seed4.pos.nimiq-testnet.com/tcp/8443/wss',
    ],
    privilegedOrigins: [ '*' ],
    redirectTarget: window.location.protocol + '//' + window.location.hostname + ':8080/demos.html',
    reportToSentry: false,
    checkoutWithoutNimOrigins: [ '*' ],

    enableBitcoin: true,
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
