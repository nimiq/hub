import Vue from 'vue';
import App from './App.vue';
import router from './router';
import store from './store';
import staticStore from '@/lib/StaticStore';
import RpcApi from '@/lib/RpcApi';
import VueRaven from 'vue-raven'; // Sentry.io SDK

Vue.config.productionTip = false;

const rpcApi = new RpcApi(store, staticStore, router);
Vue.prototype.$rpc = rpcApi;

Vue.use(VueRaven, {
  dsn: 'https://92f2289fc2ac4c809dfa685911f865c2@sentry.io/1330855',
});

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
