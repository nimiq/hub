import Vue from 'vue';
import VueI18n from 'vue-i18n';
import { BrowserDetection } from '@nimiq/utils';
import App from './App.vue';
import router from './router';
import store from './store';
import staticStore from '@/lib/StaticStore';
import RpcApi from '@/lib/RpcApi';
import { startSentry } from './lib/Sentry';
import { i18n, loadLanguageAsync, autodetectLanguage } from './i18n/i18n-setup';
// @ts-ignore
import IqonsSvg from '@nimiq/iqons/dist/iqons.min.svg';

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

const rpcApi = new RpcApi(store, staticStore, router);
Vue.prototype.$rpc = rpcApi; // rpcApi is started in App.vue->created()

Vue.use(VueI18n);

startSentry(Vue);

const app = new Vue({
    data: { loading: true },
    router,
    store,
    i18n,
    render: (h) => h(App),
}).$mount('#app');

loadLanguageAsync(autodetectLanguage());

let _loadingTimeout: number = -1;
router.beforeEach((to, from, next) => {
    if (_loadingTimeout === -1) {
        // Only show loader when lazy-loading takes longer than 500ms
        _loadingTimeout = window.setTimeout(() => app.loading = true, 500);
    }
    next();
});
router.afterEach(() => {
    window.clearTimeout(_loadingTimeout);
    _loadingTimeout = -1;
    app.loading = false;
});

// Types
declare module 'vue/types/vue' {
    interface Vue {
        $rpc: RpcApi;
    }
}
