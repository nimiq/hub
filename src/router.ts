import Vue from 'vue';
import Router from 'vue-router';
import SignTransaction from './views/SignTransaction.vue';
import SignTransactionSuccess from './views/SignTransactionSuccess.vue';
import Checkout from './views/Checkout.vue';
import CheckoutOverview from './views/CheckoutOverview.vue';
import CheckoutSelectAccount from './views/CheckoutSelectAccount.vue';
import CheckoutTransmission from './views/CheckoutTransmission.vue';
import Signup from './views/Signup.vue';
import SignupTypeSelector from './views/SignupTypeSelector.vue';
import SignupSuccess from './views/SignupSuccess.vue';
import Login from './views/Login.vue';
import LoginSuccess from './views/LoginSuccess.vue';
import ExportFile from './views/ExportFile.vue';
import ExportWords from './views/ExportWords.vue';
import Logout from './views/Logout.vue';
import LogoutSuccess from './views/LogoutSuccess.vue';
import SimpleSuccess from './views/SimpleSuccess.vue';
import {RequestType} from '@/lib/RequestTypes';
import {KeyguardCommand} from '@nimiq/keyguard-client';

Vue.use(Router);

export function keyguardResponseRouter(
  command: string,
  originalRequestType: RequestType,
): {resolve: string, reject: string} {
  switch (command) {
    case KeyguardCommand.CREATE:
      return {
        resolve: `${RequestType.SIGNUP}-success`,
        reject: RequestType.SIGNUP,
      };
    case KeyguardCommand.IMPORT:
      return {
        resolve: `${RequestType.LOGIN}-success`,
        reject: RequestType.LOGIN,
      };
    case KeyguardCommand.REMOVE:
      return {
        resolve: `${RequestType.LOGOUT}-success`,
        reject: RequestType.LOGOUT,
      };
    case KeyguardCommand.SIGN_TRANSACTION:
      // The SIGN_TRANSACTION Keyguard command is used by Accounts' SIGNTRANSACTION, CHECKOUT and CASHLINK (future)
      // Thus we return the user to the respective handler component
      return {
        resolve: `${originalRequestType}-success`,
        reject: originalRequestType,
      };
    case KeyguardCommand.EXPORT_FILE:
      return {
        resolve: `${RequestType.EXPORT_FILE}-success`,
        reject: RequestType.EXPORT_FILE,
      };
    case KeyguardCommand.EXPORT_WORDS:
      return {
        resolve: `${RequestType.EXPORT_WORDS}-success`,
        reject: RequestType.EXPORT_WORDS,
      };
    default:
      throw new Error(`router.keyguardResponseRouter not defined for Keyguard command: ${command}`);
  }
}

export default new Router({
  mode: 'history',
  base: process.env.BASE_URL,
  routes: [
    {
      path: `/${RequestType.SIGNTRANSACTION}`,
      name: `${RequestType.SIGNTRANSACTION}`,
      component: SignTransaction,
      children: [
        {
          path: 'success',
          name: `${RequestType.SIGNTRANSACTION}-success`,
          component: SignTransactionSuccess,
        },
      ],
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
          component: CheckoutTransmission,
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
      children: [
        {
          path: 'success',
          name: `${RequestType.LOGIN}-success`,
          component: LoginSuccess,
        },
      ],
    },
    {
      path: `/${RequestType.EXPORT_FILE}`,
      component: ExportFile,
      name: RequestType.EXPORT_FILE,
    },
    {
      path: `${RequestType.EXPORT_FILE}/success`,
      component: SimpleSuccess,
      name: `${RequestType.EXPORT_FILE}-success`,
    },
    {
      path: `/${RequestType.EXPORT_WORDS}`,
      component: ExportWords,
      name: RequestType.EXPORT_WORDS,
    },
    {
      path: `/${RequestType.EXPORT_WORDS}/success`,
      component: SimpleSuccess,
      name: `${RequestType.EXPORT_WORDS}-success`,
    },
    {
      path: `/${RequestType.LOGOUT}`,
      component: Logout,
      name: RequestType.LOGOUT,
    },
    {
      path: `/${RequestType.LOGOUT}/success`,
      component: LogoutSuccess,
      name: `${RequestType.LOGOUT}-success`,
    },
  ],
});
