import Vue from 'vue';
import { captureException, init } from '@sentry/vue';
import Config from 'config';
import { NETWORK_MAIN } from './Constants';

// Strip potentially confidential URL fragments like Cashlinks or RPC requests.
// Sentry puts the page url into the request data, navigation breadcrumbs and, for errors without stack trace and source
// file, a stack frame, and component props or logs can contain urls, too.
function stripUrlFragments<T>(value: T): T;
function stripUrlFragments(value: unknown): unknown {
    if (typeof value === 'string') {
        // No URL parsing, as it can't tell relative urls from other strings nor find urls within text. Instead,
        // a # after a / within the same word is taken as the start of a url fragment.
        return value.replace(/(\/[^\s#"']*)#[^\s"']*/g, '$1');
    }
    if (Array.isArray(value)) {
        return value.map(stripUrlFragments);
    }
    if (value && Object.getPrototypeOf(value) === Object.prototype) {
        const result: Record<string, unknown> = {};
        for (const [key, entry] of Object.entries(value as object)) {
            result[key] = stripUrlFragments(entry);
        }
        return result;
    }
    return value;
}

export function startSentry() {
    init({
        dsn: 'https://92f2289fc2ac4c809dfa685911f865c2@o208918.ingest.sentry.io/1330855',
        Vue,
        environment: Config.network,
        attachProps: true,
        enabled: Config.reportToSentry,
        logErrors: true,
        sampleRate: Config.network === NETWORK_MAIN ? 0.2 : 1,
        beforeSend: stripUrlFragments,
    });
    Vue.prototype.$captureException = captureException;
}

// Types
declare module 'vue/types/vue' {
    interface Vue {
        $captureException: typeof captureException;
    }
}
