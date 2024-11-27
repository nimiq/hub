import Vue from 'vue';
import { BrowserDetection } from '@nimiq/utils';
import { setAssetPublicPath as setVueComponentsAssetPath } from '@nimiq/vue-components';
import App from './CashlinkApp.vue';
import store from './store';
import { startSentry } from './lib/Sentry';
import { i18n, setLanguage, detectLanguage } from './i18n/i18n-setup';

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

// Set asset path relative to the public path defined in vue.config.json,
// see https://cli.vuejs.org/guide/mode-and-env.html#using-env-variables-in-client-side-code
setVueComponentsAssetPath(`${process.env.BASE_URL}js/`, `${process.env.BASE_URL}img/`);

async function main() {
    // Load the main Nimiq WASM module and make it available globally.
    // This must happen before creating the RpcApi instance, because it can try to recover state in its
    // constructor, which in turn uses the RequestParser, which needs the Nimiq module.
    window.Nimiq = await window.loadAlbatross();

    startSentry();

    setLanguage(detectLanguage()).then(() => {
        const app = new Vue({
            store,
            i18n,
            render: (h) => h(App),
        }).$mount('#app');
    });
}

main();
