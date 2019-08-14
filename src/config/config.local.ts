import { NETWORK_TEST } from '../lib/Constants';

export default {
    keyguardEndpoint: window.location.protocol + '//' + window.location.hostname + ':8000/src',
    network: NETWORK_TEST,
    networkEndpoint: 'http://localhost:8001',
    privilegedOrigins: [ '*' ],
    reportToSentry: false,
};
