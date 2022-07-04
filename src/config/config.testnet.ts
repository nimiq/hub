import { NETWORK_TEST } from '../lib/Constants';
import { BTC_NETWORK_TEST, NATIVE_SEGWIT } from '../lib/bitcoin/BitcoinConstants';

export default {
    keyguardEndpoint: 'https://keyguard.nimiq-testnet.com',
    network: NETWORK_TEST,
    networkEndpoint: 'https://network.nimiq-testnet.com',
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

    fastspot: {
        apiEndpoint: 'https://api.test.fastspot.io/fast/v1',
        apiKey: 'd011aeea-41cf-4c05-a31d-436495bed9b7',
    },
    TEN31Pass: {
        endpoint: 'https://test.pass.ten31.com/',
    },
};
