import { init as initSentry, captureException } from '@sentry/vue';
import Config from 'config';

export function startSentry(Vue: any) {
    if (Config.reportToSentry) {
        initSentry({
            dsn: 'https://92f2289fc2ac4c809dfa685911f865c2@o208918.ingest.sentry.io/1330855',
            Vue,
            environment: Config.network,
            attachProps: true,
        });
        Vue.prototype.$captureException = captureException;
    }
}

// Types
declare module 'vue/types/vue' {
    interface Vue {
        $captureException?: typeof captureException;
    }
}
