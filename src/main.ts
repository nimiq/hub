import Vue from 'vue';
import App from './App.vue';
import router from './router';
import store from './store';
import AsyncComputed from 'vue-async-computed';
import RpcApi from "@/lib/RpcApi";

Vue.config.productionTip = false;
Vue.use(AsyncComputed);

new Vue({
  router,
  store,
  render: (h) => h(App),
}).$mount('#app');

// Start RPC Api
new RpcApi(store, router).start();
