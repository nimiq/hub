import { NETWORK_TEST } from './src/lib/Constants';

export default {
    keyguardEndpoint: window.location.protocol + '//' + window.location.hostname + ':8000/src',
    network: NETWORK_TEST,
    networkEndpoint: 'https://network.nimiq-testnet.com',
    privilegedOrigins: [ window.location.protocol + '//' + window.location.hostname + ':8001' ],
};
