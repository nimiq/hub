import type { NimiqVersion as LedgerApiNimiqVersion } from '@nimiq/ledger-api'; // import type only to avoid bundling
import { NETWORK_MAIN } from '../lib/Constants';
import { BTC_NETWORK_TEST, NATIVE_SEGWIT } from '../lib/bitcoin/BitcoinConstants';
import { POLYGON_NETWORK_TEST } from '../lib/polygon/PolygonConstants';

export default {
    keyguardEndpoint: window.location.protocol + '//' + window.location.hostname + ':8000/src',
    ledgerApiNimiqVersion: 'albatross' as LedgerApiNimiqVersion.ALBATROSS,
    network: NETWORK_MAIN,
    nimiqNetworkId: 24,
    seedNodes: [
        '/dns4/aurora.seed.nimiq.com/tcp/443/wss',
        '/dns4/catalyst.seed.nimiq.network/tcp/443/wss',
        '/dns4/cipher.seed.nimiq-network.com/tcp/443/wss',
        '/dns4/eclipse.seed.nimiq.cloud/tcp/443/wss',
        '/dns4/lumina.seed.nimiq.systems/tcp/443/wss',
        '/dns4/nebula.seed.nimiq.com/tcp/443/wss',
        '/dns4/nexus.seed.nimiq.network/tcp/443/wss',
        '/dns4/polaris.seed.nimiq-network.com/tcp/443/wss',
        '/dns4/photon.seed.nimiq.cloud/tcp/443/wss',
        '/dns4/pulsar.seed.nimiq.systems/tcp/443/wss',
        '/dns4/quasar.seed.nimiq.com/tcp/443/wss',
        '/dns4/solstice.seed.nimiq.network/tcp/443/wss',
        '/dns4/vortex.seed.nimiq.cloud/tcp/443/wss',
        '/dns4/zenith.seed.nimiq.systems/tcp/443/wss',
    ],
    privilegedOrigins: ['http://localhost:8080'],
    redirectTarget: window.location.protocol + '//' + window.location.hostname + ':8080/demos.html',
    reportToSentry: false,
    checkoutWithoutNimOrigins: [],

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
