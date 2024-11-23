import type { NimiqVersion as LedgerApiNimiqVersion } from '@nimiq/ledger-api'; // import type only to avoid bundling
import { NETWORK_MAIN } from '../lib/Constants';
import { BTC_NETWORK_MAIN, NATIVE_SEGWIT } from '../lib/bitcoin/BitcoinConstants';
import { POLYGON_NETWORK_MAIN } from '../lib/polygon/PolygonConstants';

export default {
    keyguardEndpoint: 'https://keyguard.nimiq.com',
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
    privilegedOrigins: [
        'https://safe.nimiq.com',
        'https://wallet.nimiq.com',
        'https://hub.nimiq.com', // To allow CashlinkReceive to trigger signup/login/onboard
        'https://www.nimiq.com', // To allow gift cards app to request returnLink for Cashlinks
        'https://nimiq.com', // To allow gift cards app to request returnLink for Cashlinks
    ],
    redirectTarget: 'https://wallet.nimiq.com',
    reportToSentry: true,
    checkoutWithoutNimOrigins: [
        'https://vendor.cryptopayment.link',
        'https://cryptopayment.link',
    ],

    enableBitcoin: true,
    bitcoinNetwork: BTC_NETWORK_MAIN,
    bitcoinAddressType: NATIVE_SEGWIT,

    // enablePolygon: true,
    polygonNetwork: POLYGON_NETWORK_MAIN,

    fastspot: {
        apiEndpoint: 'https://api.go.fastspot.io/fast/v1',
        apiKey: 'c20d43d0-8f60-4fca-a298-85e80f64d042',
    },

    oasis: {
        apiEndpoint: 'https://oasis.ten31.com/v1',
    },
};
