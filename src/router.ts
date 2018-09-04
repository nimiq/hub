import Vue from 'vue';
import Router from 'vue-router';
import Checkout from './views/Checkout.vue';
import CheckoutOverview from './views/CheckoutOverview.vue';
import CheckoutSelectAccount from './views/CheckoutSelectAccount.vue';
import CheckoutSuccess from './views/CheckoutSuccess.vue';
import Create from './views/Create.vue';
import Login from './views/Login.vue';
import MetaAbout from './views/MetaAbout.vue';
import {RequestType} from '@/lib/RequestTypes';
import {KeyguardCommand} from '@nimiq/keyguard-client';

Vue.use(Router);

export const keyguardResponseRouter: { [index: string]: {resolve: string, reject: string} } = {
    [KeyguardCommand.IMPORT]: {
        resolve: `${RequestType.LOGIN}-success`,
        reject: RequestType.LOGIN,
    },
    [KeyguardCommand.SIGN_TRANSACTION]: {
        resolve: `${RequestType.CHECKOUT}-success`,
        reject: RequestType.CHECKOUT,
    },
};

export default new Router({
  mode: 'history',
  base: process.env.BASE_URL,
  routes: [
    {
      path: `/${RequestType.CHECKOUT}`,
      component: Checkout,
      children: [
        {
          path: '',
          name: RequestType.CHECKOUT,
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
      path: `/${RequestType.CREATE}`,
      component: Create,
      name: RequestType.CREATE,
      // children: [
      //   {
      //     path: '',
      //     name: RequestType.CREATE,
      //     component: CreateTypeSelector,
      //   },
      //   {
      //     path: 'set-label',
      //     name: `${RequestType.CREATE}-set-label`,
      //     component: CreateSetLabel,
      //   },
      //   {
      //     path: 'success',
      //     name: `${RequestType.CREATE}-success`,
      //     component: CreateSuccess,
      //   },
      // ],
    },
    {
      path: `/${RequestType.LOGIN}`,
      component: Login,
      name: RequestType.LOGIN,
      // children: [
      //   {
      //     path: '',
      //     name: RequestType.CREATE,
      //     component: CreateTypeSelector,
      //   },
      //   {
      //     path: 'set-label',
      //     name: `${RequestType.CREATE}-set-label`,
      //     component: CreateSetLabel,
      //   },
      //   {
      //     path: 'success',
      //     name: `${RequestType.CREATE}-success`,
      //     component: CreateSuccess,
      //   },
      // ],
    },
    {
      path: '/meta-about',
      name: 'meta-about',
      component: MetaAbout,
    },
  ],
});
