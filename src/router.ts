import Vue from 'vue';
import Router from 'vue-router';
import SignTransaction from './views/SignTransaction.vue';
import Checkout from './views/Checkout.vue';
import CheckoutOverview from './views/CheckoutOverview.vue';
import CheckoutSelectAccount from './views/CheckoutSelectAccount.vue';
import CheckoutSuccess from './views/CheckoutSuccess.vue';
import Signup from './views/Signup.vue';
import SignupTypeSelector from './views/SignupTypeSelector.vue';
import SignupSuccess from './views/SignupSuccess.vue';
import Login from './views/Login.vue';
import {RequestType} from '@/lib/RequestTypes';
import {KeyguardCommand} from '@nimiq/keyguard-client';

Vue.use(Router);

export const keyguardResponseRouter: { [index: string]: {resolve: string, reject: string} } = {
    [KeyguardCommand.CREATE]: {
        resolve: `${RequestType.SIGNUP}-success`,
        reject: RequestType.SIGNUP,
    },
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
      path: `/${RequestType.SIGNTRANSACTION}`,
      name: `${RequestType.SIGNTRANSACTION}`,
      component: SignTransaction,
      // children: [
      //   {
      //     path: 'success',
      //     name: `${RequestType.SIGNTRANSACTION}-success`,
      //     component: CheckoutSuccess,
      //   },
      // ],
    },
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
      path: `/${RequestType.SIGNUP}`,
      component: Signup,
      children: [
            {
                path: '',
                name: RequestType.SIGNUP,
                component: SignupTypeSelector,
            },
            {
                path: 'success',
                name: `${RequestType.SIGNUP}-success`,
                component: SignupSuccess,
            },
       ],
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
  ],
});
