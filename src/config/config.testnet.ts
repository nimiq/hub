import type { NimiqVersion as LedgerApiNimiqVersion } from '@nimiq/ledger-api'; // import type only to avoid bundling
import { NETWORK_TEST } from '../lib/Constants';
import { BTC_NETWORK_TEST, NATIVE_SEGWIT } from '../lib/bitcoin/BitcoinConstants';
import { POLYGON_NETWORK_TEST } from '../lib/polygon/PolygonConstants';

export default {
    keyguardEndpoint: 'https://keyguard.nimiq-testnet.com',
    ledgerApiNimiqVersion: 'albatross' as LedgerApiNimiqVersion.ALBATROSS,
    network: NETWORK_TEST,
    nimiqNetworkId: 5,
    seedNodes: [
        '/dns4/seed1.pos.nimiq-testnet.com/tcp/8443/wss',
        '/dns4/seed2.pos.nimiq-testnet.com/tcp/8443/wss',
        '/dns4/seed3.pos.nimiq-testnet.com/tcp/8443/wss',
        '/dns4/seed4.pos.nimiq-testnet.com/tcp/8443/wss',
    ],
    privilegedOrigins: [
        'https://safe.nimiq-testnet.com',
        'https://wallet.nimiq-testnet.com',
        'https://hub.nimiq-testnet.com', // For testing with the deployed demos.html page
        'https://www.nimiq-testnet.com', // To allow gift cards app to request returnLink for Cashlinks
        'https://nimiq-testnet.com', // To allow gift cards app to request returnLink for Cashlinks
    ],
    redirectTarget: 'https://wallet.nimiq-testnet.com',
    reportToSentry: true,
    checkoutWithoutNimOrigins: [
        'https://checkout-service-staging-0.web.app',
    ],

    enableBitcoin: true,
    bitcoinNetwork: BTC_NETWORK_TEST,
    bitcoinAddressType: NATIVE_SEGWIT,

    polygon: {
        network: POLYGON_NETWORK_TEST,
        networkId: 80002,
        rpcEndpoint: 'wss://polygon-amoy.g.alchemy.com/v2/#ALCHEMY_API_KEY#',
        rpcMaxBlockRange: 648_000, // 15 days - Maximum supported range by Alchemy?
        usdc: {
            tokenContract: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
            transferContract: '', // v1
            earliestHistoryScanHeight: 13320830, // Block when Wallet was switched to Amoy testnet
        },
        usdt_bridged: {
            tokenContract: '0x1616d425Cd540B256475cBfb604586C8598eC0FB',
            transferContract: '',
            earliestHistoryScanHeight: 13320830, // Block when USDT was added to the Wallet
        },
        openGsnRelayHubContract: '',
        uniswapQuoterContract: '',
        wpolContract: '0xA5733b3A8e62A8faF43b0376d5fAF46E89B3033E',
    },

    fastspot: {
        apiEndpoint: 'https://api.test.fastspot.io/fast/v1',
        apiKey: 'd011aeea-41cf-4c05-a31d-436495bed9b7',
    },

    oasis: {
        apiEndpoint: 'https://api-sandbox.nimiqoasis.com/v1',
    },
};
