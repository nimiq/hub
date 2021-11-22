import { NETWORK_TEST } from '../lib/Constants';
import { BTC_NETWORK_TEST, NATIVE_SEGWIT } from '../lib/bitcoin/BitcoinConstants';

export default {
    keyguardEndpoint: window.location.protocol + '//' + window.location.hostname + ':9000/keyguard',
    network: NETWORK_TEST,
    networkEndpoint: 'https://network.nimiq-testnet.com',
    privilegedOrigins: [ '*' ],
    redirectTarget: window.location.protocol + '//' + window.location.hostname + ':9000/hub/demos.html',
    reportToSentry: false,
    checkoutWithoutNimOrigins: [ '*' ],

    enableBitcoin: true,
    bitcoinNetwork: BTC_NETWORK_TEST,
    bitcoinAddressType: NATIVE_SEGWIT,

    fastspot: {
        apiEndpoint: 'https://api.test.fastspot.io/fast/v1',
        apiKey: 'd011aeea-41cf-4c05-a31d-436495bed9b7',
    },
};
