import Vue from 'vue';
import Router from 'vue-router';
import { RequestType } from '@/lib/RequestTypes';
import { KeyguardCommand } from '@nimiq/keyguard-client';

const SignTransaction         = () => import(/*webpackChunkName: "sign-transaction"*/ './views/SignTransaction.vue');
const SignTransactionSuccess  = () => import(/*webpackChunkName: "sign-transaction"*/
    './views/SignTransactionSuccess.vue');

const Checkout                = () => import(/*webpackChunkName: "checkout"*/ './views/Checkout.vue');
const CheckoutTransmission    = () => import(/*webpackChunkName: "checkout"*/ './views/CheckoutTransmission.vue');
const CheckoutErrorHandler    = () => import(/*webpackChunkName: "checkout"*/ './views/CheckoutErrorHandler.vue');

const OnboardingSelector      = () => import(/*webpackChunkName: "onboarding"*/ './views/OnboardingSelector.vue');

const Signup                  = () => import(/*webpackChunkName: "onboarding"*/ './views/Signup.vue');
const SignupSuccess           = () => import(/*webpackChunkName: "onboarding"*/ './views/SignupSuccess.vue');
const SignupErrorHandler      = () => import(/*webpackChunkName: "onboarding"*/ './views/SignupErrorHandler.vue');

const SignupLedger            = () => import(/*webpackChunkName: "signup-ledger"*/ './views/SignupLedger.vue');

const Login                   = () => import(/*webpackChunkName: "onboarding"*/ './views/Login.vue');
const LoginSuccess            = () => import(/*webpackChunkName: "onboarding"*/ './views/LoginSuccess.vue');
const LoginErrorHandler       = () => import(/*webpackChunkName: "onboarding"*/ './views/LoginErrorHandler.vue');

const Export                  = () => import(/*webpackChunkName: "export"*/ './views/Export.vue');

const ChangePassphrase        = () => import(/*webpackChunkName: "change-passphrase"*/ './views/ChangePassphrase.vue');

const Logout                  = () => import(/*webpackChunkName: "logout"*/ './views/Logout.vue');
const LogoutSuccess           = () => import(/*webpackChunkName: "logout"*/ './views/LogoutSuccess.vue');

const AddAccount              = () => import(/*webpackChunkName: "add-account"*/ './views/AddAccount.vue');
const AddAccountSuccess       = () => import(/*webpackChunkName: "add-account"*/ './views/AddAccountSuccess.vue');

const Rename                  = () => import(/*webpackChunkName: "rename"*/ './views/Rename.vue');

const Migrate                 = () => import(/*webpackChunkName: "migrate"*/ './views/Migrate.vue');

const SignMessage             = () => import(/*webpackChunkName: "sign-message"*/ './views/SignMessage.vue');
const SignMessageSuccess      = () => import(/*webpackChunkName: "sign-message"*/ './views/SignMessageSuccess.vue');
const SignMessageErrorHandler = () => import(/*webpackChunkName: "sign-message"*/
    './views/SignMessageErrorHandler.vue');

const ActiveAccountSelector   = () => import(/*webpackChunkName: "common"*/ './views/ActiveAccountSelector.vue');
const SimpleSuccess           = () => import(/*webpackChunkName: "common"*/ './views/SimpleSuccess.vue');
const ErrorHandler            = () => import(/*webpackChunkName: "common"*/ './views/ErrorHandler.vue');

Vue.use(Router);

export function keyguardResponseRouter(
    command: string,
    originalRequestType: RequestType,
): { resolve: string, reject: string } {
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
                reject: 'default-error',
            };
        case KeyguardCommand.SIGN_TRANSACTION:
            // The SIGN_TRANSACTION Keyguard command is used by Accounts' SIGN_TRANSACTION, CHECKOUT and
            // CASHLINK (future). Thus we return the user to the respective handler component
            return {
                resolve: `${originalRequestType}-success`,
                reject: `${originalRequestType === RequestType.CHECKOUT ? originalRequestType : 'default'}-error`,
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
        case KeyguardCommand.SIGN_MESSAGE:
            return {
                resolve: `${originalRequestType}-success`,
                reject: `${originalRequestType}-error`,
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
            name: RequestType.CHECKOUT,
        },
        {
            path: `/${RequestType.CHECKOUT}/success`,
            component: CheckoutTransmission,
            name: `${RequestType.CHECKOUT}-success`,
        },
        {
            path: `/${RequestType.CHECKOUT}/error`,
            component: CheckoutErrorHandler,
            name: `${RequestType.CHECKOUT}-error`,
        },
        {
            path: `/${RequestType.ONBOARD}`,
            component: OnboardingSelector,
            name: `${RequestType.ONBOARD}`,
        },
        {
            path: `/${RequestType.SIGNUP}`,
            component: Signup,
            name: `${RequestType.SIGNUP}`,
        },
        {
            path: `/${RequestType.SIGNUP}/ledger`,
            component: SignupLedger,
            name: `${RequestType.SIGNUP}-ledger`,
        },
        {
            path: `/${RequestType.SIGNUP}/success`,
            component: SignupSuccess,
            name: `${RequestType.SIGNUP}-success`,
        },
        {
            path: `/${RequestType.SIGNUP}/error`,
            component: SignupErrorHandler,
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
            component: LoginErrorHandler,
            name: `${RequestType.LOGIN}-error`,
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
        {
            path: `/${RequestType.RENAME}`,
            component: Rename,
            name: RequestType.RENAME,
        },
        {
            path: `/${RequestType.MIGRATE}`,
            component: Migrate,
            name: RequestType.MIGRATE,
        },
        {
            path: `/${RequestType.SIGN_MESSAGE}`,
            component: SignMessage,
            name: RequestType.SIGN_MESSAGE,
        },
        {
            path: `/${RequestType.SIGN_MESSAGE}/success`,
            component: SignMessageSuccess,
            name: `${RequestType.SIGN_MESSAGE}-success`,
        },
        {
            path: `/${RequestType.SIGN_MESSAGE}/error`,
            component: SignMessageErrorHandler,
            name: `${RequestType.SIGN_MESSAGE}-error`,
        },
    ],
});
