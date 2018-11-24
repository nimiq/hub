import Vue from 'vue';
import Router from 'vue-router';
import SignTransaction from './views/SignTransaction.vue';
import SignTransactionSuccess from './views/SignTransactionSuccess.vue';
import ActiveAccountSelector from './views/ActiveAccountSelector.vue';
import Checkout from './views/Checkout.vue';
import CheckoutOverview from './views/CheckoutOverview.vue';
import CheckoutTransmission from './views/CheckoutTransmission.vue';
import SignupTypeSelector from './views/SignupTypeSelector.vue';
import SignupSuccess from './views/SignupSuccess.vue';
import Login from './views/Login.vue';
import LoginSuccess from './views/LoginSuccess.vue';
import ExportFile from './views/ExportFile.vue';
import ExportWords from './views/ExportWords.vue';
import Export from './views/Export.vue';
import ChangePassphrase from './views/ChangePassphrase.vue';
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
        reject: RequestType.SIGNUP,
      };
    case KeyguardCommand.IMPORT:
      return {
        resolve: `${RequestType.LOGIN}-success`,
        reject: 'default-error',
      };
    case KeyguardCommand.REMOVE:
      return {
        resolve: `${RequestType.LOGOUT}-success`,
        reject: 'default-error',
      };
    case KeyguardCommand.SIGN_TRANSACTION:
      // The SIGN_TRANSACTION Keyguard command is used by Accounts' SIGN_TRANSACTION, CHECKOUT and CASHLINK (future)
      // Thus we return the user to the respective handler component
      return {
        resolve: `${originalRequestType}-success`,
        reject: `${originalRequestType === RequestType.CHECKOUT ? originalRequestType : 'default'}-error`,
      };
    case KeyguardCommand.EXPORT_FILE:
      return {
        resolve: `${RequestType.EXPORT_FILE}-success`,
        reject: 'default-error',
      };
    case KeyguardCommand.EXPORT_WORDS:
      return {
        resolve: `${RequestType.EXPORT_WORDS}-success`,
        reject: 'default-error',
      };
    case KeyguardCommand.EXPORT:
        return {
          resolve: `${RequestType.EXPORT}-success`,
          reject: 'default-error',
        };
    case KeyguardCommand.CHANGE_PASSPHRASE:
        return {
          resolve: `${RequestType.CHANGE_PASSPHRASE}-success`,
          reject: 'default-error',
        };
    case KeyguardCommand.DERIVE_ADDRESS:
      return {
        resolve: `${RequestType.ADD_ACCOUNT}-success`,
        reject: 'default-error',
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
      path: '/error',
      component: ErrorHandler,
      name: 'default-error',
    },
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
          component: ActiveAccountSelector,
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
      path: `/${RequestType.EXPORT}`,
      component: Export,
      name: RequestType.EXPORT,
    },
    {
      path: `/${RequestType.EXPORT}/success`,
      component: SimpleSuccess,
      name: `${RequestType.EXPORT}-success`,
    },
    {
      path: `/${RequestType.CHANGE_PASSPHRASE}`,
      component: ChangePassphrase,
      name: RequestType.CHANGE_PASSPHRASE,
    },
    {
      path: `/${RequestType.CHANGE_PASSPHRASE}/success`,
      component: SimpleSuccess,
      name: `${RequestType.CHANGE_PASSPHRASE}-success`,
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
