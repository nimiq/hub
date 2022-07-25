import { NETWORK_MAIN } from '../lib/Constants';
import { BTC_NETWORK_MAIN, NATIVE_SEGWIT } from '../lib/bitcoin/BitcoinConstants';

export default {
    keyguardEndpoint: 'https://keyguard.nimiq.com',
    network: NETWORK_MAIN,
    networkEndpoint: 'https://network.nimiq.com',
    privilegedOrigins: [
        'https://safe.nimiq.com',
        'https://wallet.nimiq.com',
        'https://hub.nimiq.com', // To allow CashlinkReceive to trigger signup/login/onboard
        'https://www.nimiq.com', // To allow gift cards app to request returnLink for Cashlinks
        'https://nimiq.com', // To allow gift cards app to request returnLink for Cashlinks
    ],
    redirectTarget: 'https://wallet.nimiq.com',
    reportToSentry: false,
    checkoutWithoutNimOrigins: [
        'https://vendor.cryptopayment.link',
        'https://cryptopayment.link',
    ],

    enableBitcoin: true,
    bitcoinNetwork: BTC_NETWORK_MAIN,
    bitcoinAddressType: NATIVE_SEGWIT,

    fastspot: {
        apiEndpoint: 'https://api.go.fastspot.io/fast/v1',
        apiKey: 'c20d43d0-8f60-4fca-a298-85e80f64d042',
    },

    oasis: {
        apiEndpoint: 'https://oasis.ten31.com/v1',
    },
};
