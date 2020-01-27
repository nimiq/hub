import Config from 'config';
import {
    NETWORK_TEST,
    NETWORK_DEV,
    NETWORK_MAIN,
    ERROR_INVALID_NETWORK,
} from '../lib/Constants';
import { init as initSentry, captureException } from '@sentry/browser';
import { Vue as SentryVueIntegration } from '@sentry/integrations';
import { MOBILE_MAX_WIDTH } from './Constants';

export function setHistoryStorage(key: string, data: any) {
    // Note that data can be anything that can be structurally cloned:
    // https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm
    history.replaceState({
        ...history.state,
        [key]: data,
    }, '');
}

export function getHistoryStorage(key: string): any | undefined {
    return history.state ? history.state[key] : undefined;
}

export const loadNimiq = async () => {
    await Nimiq.WasmHelper.doImport();
    let genesisConfigInitialized = true;
    try {
        Nimiq.GenesisConfig.NETWORK_ID; // tslint:disable-line:no-unused-expression
    } catch (e) {
        genesisConfigInitialized = false;
    }
    if (!genesisConfigInitialized) {
        switch (Config.network) {
            case NETWORK_TEST:
                Nimiq.GenesisConfig.test();
                break;
            case NETWORK_MAIN:
                Nimiq.GenesisConfig.main();
                break;
            case NETWORK_DEV:
                Nimiq.GenesisConfig.dev();
                break;
            default:
                throw new Error(ERROR_INVALID_NETWORK);
        }
    }
};

export function isPriviledgedOrigin(origin: string) {
    return Config.privilegedOrigins.includes(origin) || Config.privilegedOrigins.includes('*');
}

export function startSentry(Vue: any) {
    if (Config.reportToSentry) {
        initSentry({
            dsn: 'https://92f2289fc2ac4c809dfa685911f865c2@sentry.io/1330855',
            integrations: [new SentryVueIntegration({Vue, attachProps: true})],
            environment: Config.network,
        });
        Vue.prototype.$captureException = captureException;
    }
}

export function isDesktop() {
    return (window.innerWidth
        || document.documentElement.clientWidth
        || document.body.clientWidth) > MOBILE_MAX_WIDTH;
}

export function isMilliseconds(time: number) {
    /*
     * 1568577148 = timestamp at time of writing
     * 100000000000 ~ 11/16/5138
     */
    return time > 100000000000;
}

// Types
declare module 'vue/types/vue' {
    interface Vue {
        $captureException?: typeof captureException;
    }
}
