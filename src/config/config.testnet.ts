import { NETWORK_TEST } from '../lib/Constants';

export default {
    keyguardEndpoint: 'https://keyguard.nimiq-testnet.com',
    network: NETWORK_TEST,
    networkEndpoint: 'https://network.nimiq-testnet.com',
    privilegedOrigins: [
        'https://safe.nimiq-testnet.com',
        'https://hub.nimiq-testnet.com', // For testing with the deployed demos.html page
        'https://www.nimiq-testnet.com', // To allow gift cards app to request returnLink for Cashlinks
        'https://nimiq-testnet.com', // To allow gift cards app to request returnLink for Cashlinks
    ],
    redirectTarget: 'https://safe.nimiq-testnet.com',
    reportToSentry: true,
};
