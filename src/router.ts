import Vue from 'vue';
import Router from 'vue-router';
import Checkout from './views/Checkout.vue';
import CheckoutOverview from './views/CheckoutOverview.vue';
import CheckoutSelectAccount from './views/CheckoutSelectAccount.vue';
import CheckoutSuccess from './views/CheckoutSuccess.vue';
import MetaAbout from './views/MetaAbout.vue';
import {RequestType} from '@/lib/RequestTypes';
import {KeyguardCommand} from '@/lib/keyguard/RequestTypes';

Vue.use(Router);

export const keyguardResponseRouter: { [index: string]: {resolve: string, reject: string} } = {
    [KeyguardCommand.SIGN_TRANSACTION]: {
        resolve: RequestType.CHECKOUT,
        reject: RequestType.CHECKOUT,
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
      children: [
        {
          path: '',
          name: `${RequestType.CHECKOUT}-overview`,
          component: CheckoutOverview,
        },
        {
          path: 'change-account',
          name: `${RequestType.CHECKOUT}-change-account`,
          component: CheckoutSelectAccount,
        },
        {
          path: 'success',
          name: `${RequestType.CHECKOUT}-success`,
          component: CheckoutSuccess,
        },
      ],
    },
    {
      path: '/meta-about',
      name: 'meta-about',
      component: MetaAbout,
    },
  ],
});
