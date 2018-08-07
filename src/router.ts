import Vue from 'vue';
import Router from 'vue-router';
import Checkout from './views/Checkout.vue';
import MetaAbout from './views/MetaAbout.vue';

Vue.use(Router);

export default new Router({
  mode: 'history',
  base: process.env.BASE_URL,
  routes: [
    {
      path: '/checkout',
      name: 'checkout',
      component: Checkout,
    },
    {
      path: '/meta-about',
      name: 'meta-about',
      component: MetaAbout,
    },
  ],
});
