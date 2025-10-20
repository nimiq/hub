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

    polygon: {
        network: POLYGON_NETWORK_MAIN,
        networkId: 137,
        rpcEndpoint: 'wss://polygon-mainnet.g.alchemy.com/v2/#ALCHEMY_API_KEY#',
        rpcMaxBlockRange: 648_000, // 15 days - Maximum supported range by Alchemy?
        usdc: {
            tokenContract: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
            transferContract: '0x3157d422cd1be13AC4a7cb00957ed717e648DFf2',
            earliestHistoryScanHeight: 45319261, // Native USDC contract creation block
        },
        usdt_bridged: {
            tokenContract: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
            transferContract: '0x98E69a6927747339d5E543586FC0262112eBe4BD',
            earliestHistoryScanHeight: 63189500, // Block when USDT was added to the Wallet
        },
        openGsnRelayHubContract: '0x6C28AfC105e65782D9Ea6F2cA68df84C9e7d750d',
        uniswapQuoterContract: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
        wpolContract: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
    },

    fastspot: {
        apiEndpoint: 'https://api.go.fastspot.io/fast/v1',
        apiKey: 'c20d43d0-8f60-4fca-a298-85e80f64d042',
    },

    oasis: {
        apiEndpoint: 'https://oasis.ten31.com/v1',
    },
};
