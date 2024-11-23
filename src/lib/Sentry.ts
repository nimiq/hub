import Vue from 'vue';
import { captureException, init } from '@sentry/vue';
import Config from 'config';
import { NETWORK_MAIN } from './Constants';

export function startSentry() {
    init({
        dsn: 'https://92f2289fc2ac4c809dfa685911f865c2@o208918.ingest.sentry.io/1330855',
        Vue,
        environment: Config.network,
        attachProps: true,
        enabled: Config.reportToSentry,
        logErrors: true,
        sampleRate: Config.network === NETWORK_MAIN ? 0.2 : 1,
    });
    Vue.prototype.$captureException = captureException;
}

// Types
declare module 'vue/types/vue' {
    interface Vue {
        $captureException: typeof captureException;
    }
}
