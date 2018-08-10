import Vue from 'vue';
import Router from 'vue-router';
import Checkout from './views/Checkout.vue';
import MetaAbout from './views/MetaAbout.vue';
import {RequestType} from '@/lib/RequestTypes';
import {KeyguardCommand} from '@/lib/keyguard/RequestTypes';

Vue.use(Router);

export const keyguardResponseRouter: { [index: string]: {resolve: string, reject: string} } = {
    [KeyguardCommand.SIGN_TRANSACTION]: {
        resolve: 'meta-about',
        reject: 'meta-about',
    },
};

export default new Router({
  mode: 'history',
  base: process.env.BASE_URL,
  routes: [
    {
      path: `/${RequestType.CHECKOUT}`,
      name: RequestType.CHECKOUT,
      component: Checkout,
    },
    {
      path: '/meta-about',
      name: 'meta-about',
      component: MetaAbout,
    },
  ],
});
