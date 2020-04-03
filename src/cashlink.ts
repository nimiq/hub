import Vue from 'vue';
import { BrowserDetection } from '@nimiq/utils';
import App from './CashlinkApp.vue';
import store from './store';
import { startSentry } from './lib/Sentry';
import VueI18n from 'vue-i18n';
// @ts-ignore
import IqonsSvg from '@nimiq/iqons/dist/iqons.min.svg';
import { i18n, loadLanguageAsync, autodetectLanguage } from './i18n/i18n-setup';

if (window.hasBrowserWarning) {
    throw new Error('Execution aborted due to browser warning');
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

startSentry(Vue);

Vue.use(VueI18n);

loadLanguageAsync(autodetectLanguage());

const app = new Vue({
    store,
    render: (h) => h(App),
    i18n,
}).$mount('#app');
