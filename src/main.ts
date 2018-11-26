import Vue from 'vue';
import App from './App.vue';
import router from './router';
import store from './store';
import staticStore from '@/lib/StaticStore';
import RpcApi from '@/lib/RpcApi';

Vue.config.productionTip = false;

Vue.prototype.$rpc = RpcApi;
declare module 'vue/types/vue' {
  interface Vue {
    $rpc: typeof RpcApi;
  }
}

new Vue({
  router,
  store,
  render: (h) => h(App),
}).$mount('#app');

// Start RPC Api
new RpcApi(store, staticStore, router).start();
