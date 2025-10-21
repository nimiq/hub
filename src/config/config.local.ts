import type { NimiqVersion as LedgerApiNimiqVersion } from '@nimiq/ledger-api'; // import type only to avoid bundling
import { ENV_DEV, NETWORK_TEST } from '../lib/Constants';
import { BTC_NETWORK_TEST, NATIVE_SEGWIT } from '../lib/bitcoin/BitcoinConstants';
import { POLYGON_NETWORK_MAIN } from '../lib/polygon/PolygonConstants';

export default {
    keyguardEndpoint: window.location.protocol + '//' + window.location.hostname + ':8000/src',
    ledgerApiNimiqVersion: 'albatross' as LedgerApiNimiqVersion.ALBATROSS,
    environment: ENV_DEV,
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

    polygon: {
        // Notably, we use the Polygon mainnet even in local/development and testnet builds, because our contracts for
        // gas-abstraction aren't available on testnet yet, because of lack of official USDC and USDT testnet contracts,
        // and thus lack of liquidity on testnet Uniswap for gas-abstracted transactions.
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
        apiEndpoint: 'https://api.test.fastspot.io/fast/v1',
        apiKey: 'd011aeea-41cf-4c05-a31d-436495bed9b7',
    },

    oasis: {
        apiEndpoint: 'https://api-sandbox.nimiqoasis.com/v1',
    },
};
