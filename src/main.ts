import Vue from 'vue';
import App from './App.vue';
import router from './router';
import store from './store';
import AsyncComputed from 'vue-async-computed';
import RpcApi from '@/lib/RpcApi';
import { ResponseStatus } from '@nimiq/rpc';

Vue.config.productionTip = false;
Vue.use(AsyncComputed);

new Vue({
  router,
  store,
  render: (h) => h(App),
}).$mount('#app');

// Start RPC Api
new RpcApi(store, router).start();

window.addEventListener('beforeunload', () => {
    store!.state!.rpcState!.reply(ResponseStatus.ERROR, new Error('Window was closed'));
});
