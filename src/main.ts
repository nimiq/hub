import Vue from 'vue';
import App from './App.vue';
import router from './router';
import store from './store';
import staticStore from '@/lib/StaticStore';
import RpcApi from '@/lib/RpcApi';
import VueRaven from 'vue-raven'; // Sentry.io SDK

Vue.config.productionTip = false;

// Set up Identicon SVG file path
// FIXME Need to find a better method to automatically detect this
// @ts-ignore
self.NIMIQ_IQONS_SVG_PATH = '/img/iqons.min.72f3b689.svg';

const rpcApi = new RpcApi(store, staticStore, router);
Vue.prototype.$rpc = rpcApi;

if (window.location.origin === 'https://accounts.nimiq-testnet.com') {
  Vue.use(VueRaven, {
    dsn: 'https://92f2289fc2ac4c809dfa685911f865c2@sentry.io/1330855',
  });
}

new Vue({
  router,
  store,
  render: (h) => h(App),
}).$mount('#app');

// Start RPC Api
rpcApi.start();

// Types
declare module 'vue/types/vue' {
  interface Vue {
    $rpc: RpcApi;
  }
}
