import Vue from 'vue';
import { BrowserDetection } from '@nimiq/utils';
import App from './CashlinkApp.vue';
import store from './store';
import { init as initSentry, captureException } from '@sentry/browser';
import { Vue as SentryVueIntegration } from '@sentry/integrations';
// @ts-ignore
import IqonsSvg from '@nimiq/iqons/dist/iqons.min.svg';
import Config from 'config';

if (window.hasBrowserWarning) {
    throw new Error('Exeution aborted due to browser warning');
}

if ((BrowserDetection.isIOS() || BrowserDetection.isSafari()) && 'serviceWorker' in navigator) {
    // Register service worker to strip cookie from requests
    navigator.serviceWorker.register('/ServiceWorker.js', {
        scope: '/',
    }).then((reg) => {
        console.debug(`Service worker has been registered for scope: ${reg.scope}`);
    }).catch((error) => {
        console.error(`Service worker installation failed`);
        throw error;
    });
}

Vue.config.productionTip = false;

// Set up Identicon SVG file path
if (IqonsSvg[0] === '"') {
    // @ts-ignore
    self.NIMIQ_IQONS_SVG_PATH = IqonsSvg.substring(1, IqonsSvg.length - 1);
} else {
    // @ts-ignore
    self.NIMIQ_IQONS_SVG_PATH = IqonsSvg;
}

if (Config.reportToSentry) {
    initSentry({
        dsn: 'https://92f2289fc2ac4c809dfa685911f865c2@sentry.io/1330855',
        integrations: [new SentryVueIntegration({Vue, attachProps: true})],
        environment: Config.network,
    });
    Vue.prototype.$captureException = captureException;
}

const app = new Vue({
    store,
    render: (h) => h(App),
}).$mount('#app');

// Types
declare module 'vue/types/vue' {
    interface Vue {
        $captureException?: typeof captureException;
    }
}
