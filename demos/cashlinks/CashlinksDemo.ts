import Vue from 'vue';
import App from './CashlinksDemo.vue';
// import RpcApi from '../../src/lib/RpcApi';
// import store from '../../src/store';
// import staticStore from '../../src/lib/StaticStore';
// import VueRouter from 'vue-router';

Vue.config.productionTip = false;

const app = new Vue({
    data: { },
    // store,
    render: (h) => h(App),
}).$mount('#app');
