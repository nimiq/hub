import { NETWORK_TEST } from '../lib/Constants';
import { BTC_NETWORK_TEST, NATIVE_SEGWIT } from '../lib/bitcoin/BitcoinConstants';

export default {
    keyguardEndpoint: window.location.protocol + '//' + window.location.hostname + ':8000/src',
    network: NETWORK_TEST,
    networkEndpoint: 'https://network.nimiq-testnet.com',
    privilegedOrigins: [ '*' ],
    redirectTarget: window.location.protocol + '//' + window.location.hostname + ':8080/demos.html',
    reportToSentry: false,
    checkoutWithoutNimOrigins: [ '*' ],

    enableBitcoin: true,
    bitcoinNetwork: BTC_NETWORK_TEST,
    bitcoinAddressType: NATIVE_SEGWIT,

    fastspot: {
        apiEndpoint: 'https://api.test.fastspot.io/fast/v1',
        apiKey: 'd011aeea-41cf-4c05-a31d-436495bed9b7',
    },
    TEN31Pass: {
        endpoint: 'https://test.pass.ten31.com/',
        services: {
            s3: {
                serviceId: '6cc93627-6b35-4c3f-9763-f03fe749631c',
                usageIds: {
                    swap: '2b099ff4-6ab8-45f4-a872-af8a321790a8',
                },
            },
            oasis: {
                // OASIS sandbox
                serviceId: '1bb1475f-4535-4019-b0a8-7e07486e9b6a',
                usageIds: {
                    clearing: 'fb4f315c-15d0-4b78-8f63-6838de698e96',
                    settling: '016db75e-b86e-4a8d-83aa-74cc7d80dc03',
                },
            },
        },
    },
};
