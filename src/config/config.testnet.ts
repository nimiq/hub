import { NETWORK_TEST } from '../lib/Constants';

export default {
    keyguardEndpoint: 'https://keyguard.nimiq-testnet.com',
    network: NETWORK_TEST,
    networkEndpoint: 'https://network.nimiq-testnet.com',
    privilegedOrigins: [
        'https://safe.nimiq-testnet.com',
        'https://hub.nimiq-testnet.com', // For testing with the deployed demos.html page
    ],
    redirectTarget: 'https://safe.nimiq-testnet.com',
    reportToSentry: true,
};
