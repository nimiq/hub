import Vue from 'vue';
import Router from 'vue-router';
import SignTransaction from './views/SignTransaction.vue';
import SignTransactionSuccess from './views/SignTransactionSuccess.vue';
import Checkout from './views/Checkout.vue';
import CheckoutOverview from './views/CheckoutOverview.vue';
import CheckoutSelectAccount from './views/CheckoutSelectAccount.vue';
import CheckoutTransmission from './views/CheckoutTransmission.vue';
import SignupTypeSelector from './views/SignupTypeSelector.vue';
import SignupSuccess from './views/SignupSuccess.vue';
import Login from './views/Login.vue';
import LoginSuccess from './views/LoginSuccess.vue';
import ExportFile from './views/ExportFile.vue';
import ExportWords from './views/ExportWords.vue';
import Logout from './views/Logout.vue';
import LogoutSuccess from './views/LogoutSuccess.vue';
import AddAccount from './views/AddAccount.vue';
import AddAccountSuccess from './views/AddAccountSuccess.vue';
import SimpleSuccess from './views/SimpleSuccess.vue';
import ErrorHandler from './views/ErrorHandler.vue';
import CheckoutErrorHandler from './views/CheckoutErrorHandler.vue';
import { RequestType } from '@/lib/RequestTypes';
import { KeyguardCommand } from '@nimiq/keyguard-client';

Vue.use(Router);

export function keyguardResponseRouter(
  command: string,
  originalRequestType: RequestType,
): {resolve: string, reject: string} {
  switch (command) {
    case KeyguardCommand.CREATE:
      return {
        resolve: `${RequestType.SIGNUP}-success`,
        reject: `${RequestType.SIGNUP}-error`,
      };
    case KeyguardCommand.IMPORT:
      return {
        resolve: `${RequestType.LOGIN}-success`,
        reject: `${RequestType.LOGIN}-error`,
      };
    case KeyguardCommand.REMOVE:
      return {
        resolve: `${RequestType.LOGOUT}-success`,
        reject: `${RequestType.LOGOUT}-error`,
      };
    case KeyguardCommand.SIGN_TRANSACTION:
      // The SIGN_TRANSACTION Keyguard command is used by Accounts' SIGN_TRANSACTION, CHECKOUT and CASHLINK (future)
      // Thus we return the user to the respective handler component
      return {
        resolve: `${originalRequestType}-success`,
        reject: `${originalRequestType}-error`,
      };
    case KeyguardCommand.EXPORT_FILE:
      return {
        resolve: `${RequestType.EXPORT_FILE}-success`,
        reject: `${RequestType.EXPORT_FILE}-error`,
      };
    case KeyguardCommand.EXPORT_WORDS:
      return {
        resolve: `${RequestType.EXPORT_WORDS}-success`,
        reject: `${RequestType.EXPORT_WORDS}-error`,
      };
    case KeyguardCommand.DERIVE_ADDRESS:
      return {
        resolve: `${RequestType.ADD_ACCOUNT}-success`,
        reject: RequestType.ADD_ACCOUNT,
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
      path: `/${RequestType.SIGN_TRANSACTION}`,
      component: SignTransaction,
      name: `${RequestType.SIGN_TRANSACTION}`,
    },
    {
      path: `/${RequestType.SIGN_TRANSACTION}/success`,
      component: SignTransactionSuccess,
      name: `${RequestType.SIGN_TRANSACTION}-success`,
    },
    {
      path: `/${RequestType.SIGN_TRANSACTION}/error`,
      component: ErrorHandler,
      name: `${RequestType.SIGN_TRANSACTION}-error`,
    },
    {
      path: `/${RequestType.CHECKOUT}`,
      component: Checkout,
      children: [
        {
          path: '',
          component: CheckoutOverview,
          name: RequestType.CHECKOUT,
        },
        {
          path: 'change-account',
          component: CheckoutSelectAccount,
          name: `${RequestType.CHECKOUT}-change-account`,
        },
        {
          path: 'success',
          component: CheckoutTransmission,
          name: `${RequestType.CHECKOUT}-success`,
        },
        {
          path: 'error',
          component: CheckoutErrorHandler,
          name: `${RequestType.CHECKOUT}-error`,
        },
      ],
    },
    {
      path: `/${RequestType.SIGNUP}`,
      component: SignupTypeSelector,
      name: `${RequestType.SIGNUP}`,
    },
    {
      path: `/${RequestType.SIGNUP}/success`,
      component: SignupSuccess,
      name: `${RequestType.SIGNUP}-success`,
    },
    {
      path: `/${RequestType.SIGNUP}/error`,
      component: ErrorHandler,
      name: `${RequestType.SIGNUP}-error`,
    },
    {
      path: `/${RequestType.LOGIN}`,
      component: Login,
      name: RequestType.LOGIN,
    },
    {
      path: `/${RequestType.LOGIN}/success`,
      component: LoginSuccess,
      name: `${RequestType.LOGIN}-success`,
    },
    {
      path: `/${RequestType.LOGIN}/error`,
      component: ErrorHandler,
      name: `${RequestType.LOGIN}-error`,
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
      path: `${RequestType.EXPORT_FILE}/error`,
      component: ErrorHandler,
      name: `${RequestType.EXPORT_FILE}-error`,
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
      path: `${RequestType.EXPORT_WORDS}/error`,
      component: ErrorHandler,
      name: `${RequestType.EXPORT_WORDS}-error`,
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
    {
      path: `/${RequestType.LOGOUT}/error`,
      component: ErrorHandler,
      name: `${RequestType.LOGOUT}-error`,
    },
    {
      path: `/${RequestType.ADD_ACCOUNT}`,
      component: AddAccount,
      name: RequestType.ADD_ACCOUNT,
    },
    {
      path: `/${RequestType.ADD_ACCOUNT}/success`,
      component: AddAccountSuccess,
      name: `${RequestType.ADD_ACCOUNT}-success`,
    },
  ],
});
