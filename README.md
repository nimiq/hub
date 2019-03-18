# Nimiq Accounts Manager <!-- omit in toc -->

The **Accounts Manager** (or **Nimiq Accounts**) provides a unified interface for
all Nimiq accounts, addresses, and contracts. It is the primary UI for Nimiq users
to manage their accounts and provides websites and apps with a concise API to
interact with their users' Nimiq addresses.

- [The Accounts Client library](#the-accounts-client-library)
  - [Installation](#installation)
  - [Initialization](#initialization)
  - [Usage](#usage)
    - [Using top-level redirects](#using-top-level-redirects)
  - [API Methods](#api-methods)
    - [Checkout](#checkout)
    - [Choose Address](#choose-address)
    - [Sign transaction](#sign-transaction)
    - [Signup](#signup)
    - [Login](#login)
    - [Logout](#logout)
    - [Export](#export)
  - [Listening for redirect responses](#listening-for-redirect-responses)
- [Running your own Accounts Manager](#running-your-own-accounts-manager)
- [Contribute](#contribute)
  - [Setup](#setup)
  - [Run](#run)
  - [Build](#build)

## The Accounts Client library

### Installation

Include the `AccountsClient` JS library as a script tag in your page:

```html
<!-- From CDN -->
<script src="https://unpkg.com/@nimiq/accounts-client@v0.1/dist/standalone/AccountsClient.standalone.umd.js"></script>
<!-- or -->
<script src="https://cdn.jsdelivr.net/npm/@nimiq/accounts-client@v0.1/dist/standalone/AccountsClient.standalone.umd.js"></script>
```

It can also be installed from NPM:

```bash
npm install @nimiq/accounts-client
# or with yarn
yarn add @nimiq/accounts-client
```

Then import or require it in your module:

```javascript
import AccountsClient from '@nimiq/accounts-client';
// or
const AccountsClient = require('@nimiq/accounts-client');
```

### Initialization

To start the client, just instantiate the class by passing it the URL of the
**Accounts Manager** to connect to:

```javascript
// Connect to testnet
const accountsClient = new AccountsClient('https://accounts.nimiq-testnet.com');

// Connect to mainnet
const accountsClient = new AccountsClient('https://accounts.nimiq.com');
```

### Usage

By default, the client opens a popup window for user interactions. On mobile
devices, a new tab will be opened instead. For simplicity, we will always refer
to popups throughout this documentation.

Popups will be blocked if not opened within the context of an active user
action. Thus, it is required that API methods are called synchronously within
the context of a user action, such as a click. See example below.

```javascript
document.getElementById('#checkoutButton').addEventListener('click', function(event){
    accountsClient.checkout(/* see details below */);
});
```

For more details about avoiding popup blocking refer to
[this article](https://javascript.info/popup-windows#popup-blocking).

#### Using top-level redirects

If you prefer top-level redirects instead of popups, you can pass an
instance of `RedirectRequestBehavior` as a second parameter to either the
AccountsClient initialization or to any API method:

```javascript
const redirectBehavior = new AccountsClient.RedirectRequestBehavior();

// Pass the behavior as a second parameter to the AccountsClient
const accountsClient = new AccountsClient(<url>, redirectBehavior);

// Or pass it as a second parameter to any API method
const result = accountsClient.checkout(<requestOptions>, redirectBehavior);
```

The `RedirectRequestBehavior` accepts two optional parameters:

The first is the return URL. If no return URL is specified, the current URL
without parameters will be used.

```javascript
const redirectBehavior = new RedirectRequestBehavior('https://url.to/return?to');
```

The second optional parameter is a plain object you can use to store data until
the request returns:

```javascript
const storedData = { foo: 'I am the state' };
const redirectBehavior = new RedirectRequestBehavior(null, storedData);
```

For details on how to listen for redirect responses and retrieve the stored
data, see [Listening for redirect responses](#listening-for-redirect-responses).

### API Methods

- [Checkout](#checkout)
- [Choose Address](#choose-address)
- [Sign transaction](#sign-transaction)
- [Signup](#signup)
- [Login](#login)
- [Logout](#logout)
- [Export](#export)

[//] TODO: Add methods 'onboard', 'changePassword', 'addAccount', 'rename', 'signMessage'

> **Note:**
>
> All API methods run asynchronously and thus return promises. Please keep in
> mind that promises can also be rejected for various reasons, e.g. if the user
> cancels the request by closing the popup window or clicking on a cancel
> button.
>
> An error can also occur when the request contains invalid parameters. The
> `Error` object will be passed on to the `reject` handler.

#### Checkout

The `checkout()` method allows your site to request a transaction from the user.
This will open a popup for the user to select the address to send from &mdash;
or cancel the request. During the payment process, the signed transaction is
sent (relayed) to the network but also returned to the caller, e.g. for
processing in your site, storage on your server or re-submittal.

```javascript
const requestOptions = {
    // The name of your app, should be as short as possible.
    appName: 'Nimiq Shop',

    // [optional] The path to an image on the same origin as the request is sent
    // from, must be square and will be displayed with up to 146px width and hight.
    shopLogoUrl: 'https://your.domain.com/path/to/an/image.jpg',

    // The human-readable address of the recipient (your shop/app).
    recipient: 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000',

    // [optional] Nimiq.Account.Type of the recipient.
    // Only required if the recipient is a vesting (1) or HTLC (2) contract.
    // Default: Nimiq.Account.Type.BASIC (0)
    //recipientType: Nimiq.Account.Type.HTLC,

    // Value of the transaction, in luna.
    value: 100 * 1e5, // 100 NIM

    // [optional] Transaction fee in luna.
    // Default: 0
    //fee: 138,

    // [optional] Extra data that should be sent with the transaction.
    // Type: Uint8Array | Nimiq.SerialBuffer
    // Default: new Uint8Array(0)
    //extraData: Nimiq.BufferUtils.fromAscii('Hello Nimiq!'),

    // [optional] Nimiq.Transaction.Flag, only required if the transaction
    // creates a contract.
    // Default: Nimiq.Transaction.Flag.NONE (0)
    //flags: Nimiq.Transaction.Flag.CONTRACT_CREATION,
};

// All client requests are async and return a promise
const checkoutResult = await accountsClient.checkout(requestOptions);
```

The `checkout()` method returns a promise which resolves to a
`SignTransactionResult`:

```javascript
interface SignTransactionResult {
    serializedTx: Uint8Array;           // The signed, serialized transaction
    sender: string;                     // Human-readable address of sender
    senderType: Nimiq.Account.Type;     // 0, 1, 2 - see recipientType above
    senderPubKey: Uint8Array;           // Serialized public key of the sender
    recipient: string;                  // Human-readable address of recipient
    recipientType: Nimiq.Account.Type;  // 0, 1, 2 - see above
    value: number;
    fee: number;
    validityStartHeight: number;        // Automatically determined validity
                                        // start height of the transaction
    signature: Uint8Array;              // Serialized signature of the sender
    extraData: Uint8Array;
    flags: number;
    networkId: number;
    hash: string;                       // Base64 transaction hash
}
```

#### Choose Address

By using the `chooseAddress()` method, you are asking the user to select one of
their addresses to provide to your website. This can be used for example to find
out, which address your app should send funds to.

**Note:** This method should not yet be used as a login or authentication mechanism,
as it does not provide any security that the user actually owns the provided address!

The method takes a simple request object as its only argument, which must only contain
the `appName` property:

```javascript
const requestOptions = {
    // The name of your app, should be as short as possible.
    appName: 'Nimiq Safe',
};

// All client requests are async and return a promise
const providedAddress = await accountsClient.chooseAddress(requestOptions);
```

The request's result contains a userfriendly address string as `address` and a `label`:

```javascript
providedAddress = {
    address: 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000',
    label: 'Burner Address',
}
```

#### Sign transaction

The `signTransaction()` method is similar to checkout, but provides a different
UI to the user. The main difference to `checkout()` is that it requires the
request to already include the sender's account (wallet) ID and address as `walletId` and
`sender` respectively, as well as the transaction's `validityStartHeight`. The
created transaction will only be returned to the caller, not sent to the network
automatically.

For brevity, most duplicate parameter explanations are omitted here, please
refer to [Checkout](#checkout) for more details.

```javascript
const requestOptions = {
    appName: 'Nimiq Safe',

    // Sender information
    walletId: 'xxxxxxxx',
    sender: 'NQxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx',

    recipient: 'NQxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx',
    value: 100 * 1e5, // 100 NIM

    // Optional attributes, see checkout method for details
    //senderType: Nimiq.Account.Type.BASIC,
    //recipientType: Nimiq.Account.Type.BASIC,
    //fee: 0,
    //extraData: new Uint8Array(0),
    //flags: Nimiq.Transaction.Flag.NONE,

    // The transaction's validity start height.
    // A transaction is only valid for 120 blocks after its validityStartHeight.
    // Transactions with a validityStartHeight higher than <current network
    // block height + 1> are rejected and need to be sent again later during
    // their validity window.
    validityStartHeight: 123456,
};

// All client requests are async and return a promise
const signTxResult = await accountsClient.signTransaction(requestOptions);
```

The `signTransaction()` method returns a `SignTransactionResult` as well. See
[Checkout](#checkout) for details.

#### Signup

The `signup()` method creates a new account in the **Accounts Manager**. The user
will choose an Identicon and optionally set a password.

```javascript
const requestOptions = {
    // The name of your app, should be as short as possible.
    appName: 'Nimiq Safe',
};

// All client requests are async and return a promise
const newAccount = await accountsClient.signup(requestOptions);
```

The `signup()` method returns a promise which resolves to a `SignupResult`:

```javascript
interface SignupResult {
    walletId: string;       // Automatically generated account (wallet) ID
    label: string;          // The label/name given to the account by the user

    type: WalletType;       // 1 for in-browser multi-address accounts,
                            // 2 for Ledger hardware accounts

    accounts: Array<{       // During signup, only one address is added to the account
        address: string;    // Human-readable address
        label: string;      // The label/name given to the address by the user
    }>;
}
```

#### Login

The `login()` method allows the user to add an existing account to the
**Accounts Manager** by importing their *Login File*, *Recovery Words* or
*Account Access File*. After an account has been imported, the
**Accounts Manager** automatically detects active addresses following the
[BIP44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki#account-discovery)
method.

```javascript
const requestOptions = {
    // The name of your app, should be as short as possible.
    appName: 'Nimiq Safe',
};

// All client requests are async and return a promise
const newAccount = await accountsClient.login(requestOptions);
```

The `login()` method returns a promise which resolves to a `LoginResult`:

```javascript
interface LoginResult {
    walletId: string;       // Automatically generated account (wallet) ID
    label: string;          // The label/name given to the account by the user

    type: WalletType;       // 0 for in-browser single-address accounts,
                            // 1 for in-browser multi-address accounts,
                            // 2 for Ledger hardware accounts

    accounts: Array<{       // Array of active addresses detected during login
        address: string;    // Human-readable address
        label: string;      // Label/name given by the user
    }>;
}
```

<!-- IDEA should we use std JS Array notation in the doc?
     Or do we officially switch to TS? Then that's another section of the
     general doc to add on this IMO. -->

#### Logout

The `logout()` method removes an account from the **Accounts Manager**. During the
logout process, the user can retrieve the *Login File* or *Recovery Words*
before the account is deleted.

```javascript
const requestOptions = {
    // The name of your app, should be as short as possible.
    appName: 'Nimiq Safe',

    // The ID of the account (wallet) that should be removed
    walletId: 'xxxxxxxx',
};

// All client requests are async and return a promise
const logoutResult = await accountsClient.logout(requestOptions);
```

The `logout()` method returns a promise which resolves to a simple object
containing the `success` property, which is always true:

```javascript
{
    success: true
}
```

<!-- TODO awaiting final decision on "simple return type" for API methods that
     don't really return anything -->

#### Export

Using the `export()` method, a user can retrieve the *Login File* or
*Recovery Words* of an account.

```javascript
const requestOptions = {
    // The name of your app, should be as short as possible.
    appName: 'Nimiq Safe',

    // The ID of the account (wallet) to export
    walletId: 'xxxxxxxx',
};

// All client requests are async and return a promise
const exportResult = await accountsClient.export(requestOptions);
```

The `export()` method returns a promise which resolves to a simple object
containing the `success` property, which is always true:

```javascript
{
    success: true
}
```

<!-- TODO awaiting final decision on "simple return type" for API methods that
     don't really return anything -->

### Listening for redirect responses

If you configured the AccountsClient to use
[top-level redirects](#using-top-level-redirects) instead of popups, you need to
follow the four steps below to specifically listen for the redirects from the
**Accounts Manager** back to your site using the `on()` method.

Your handler functions will be called with two parameters: the result object and
the stored data object as it was passed to the
`RedirectRequestBehavior` [during initialization](#using-top-level-redirects).

```javascript
// 1. Initialize an Accounts Manager client instance
const accountsClient = new AccountsClient(/* ... */);

// 2. Define your handler functions
const onSuccess = function(result, storedData) {
    console.log("Got result from Accounts Manager:", result);
    console.log("Retrieved stored data:": storedData);
}

const onError = function(error, storedData) {
    console.log("Got error from Accounts Manager:", error);
    console.log("Retrieved stored data:": storedData);
}

// 3. Listen for the redirect responses you expect
const RequestType = AccountsClient.RequestType;

accountsClient.on(RequestType.CHECKOUT, onSuccess, onError);
accountsClient.on(RequestType.SIGN_TRANSACTION, onSuccess, onError);
accountsClient.on(RequestType.LOGIN, onSuccess, onError);

// 4. After setup is complete, check for a redirect response
accountsClient.checkRedirectResponse();
```

<!-- QUESTION/IDEA The RPC ID should be explained.
     Can the dev retrieve the ID before triggering the API method so that later
     on request and result can be aligned?
     If not, what's the potential use of the ID?
     I suggestion to remove it, or at least make the ID third and thus optional.
     -->
The available `RequestType`s, corresponding to the API methods, are:

```javascript
enum AccountsClient.RequestType {
    CHECKOUT = 'checkout',
    CHOOSE_ADDRESS = 'choose-address',
    SIGN_TRANSACTION = 'sign-transaction',
    SIGNUP = 'signup',
    LOGIN = 'login',
    LOGOUT = 'logout',
    EXPORT = 'export',
}
```

## Running your own Accounts Manager

TODO

If you want to run your own instance of Accounts Manager, you also need to run an instance of [keyguard](https://github.com/nimiq/keyguard-next/).

## Contribute

To get started with working on the source code, pull the code and install the dependencies:

### Setup

```bash
git clone git@github.com:nimiq/accounts.git
cd accounts
yarn
```

### Run

Compile and serve with hot-reload in the background for development:

```bash
yarn run serve
```

Compile and lint continuously in the background for development:

```bash
yarn run build --watch
```

Lint and fix files:

```bash
yarn run lint
```

Run unit tests:

```bash
yarn run test
```

### Build

Compile and minify for production:

```bash
yarn run build
```

### Configuration

The following values can be changed via configuration files:
* keyguardEndpoint: The location of your keyguard instance.
* network: The network you want to use. Possible values are 'main', 'test' and 'dev'. You can use the constants (see default configs).
* networkEndpoint: The location of the network iframe instance you want to use.
* privilegedOrigins: An array of origins with special access rights, nameley permission to use iframe methods like `list()`.

Default config file is `config.local.ts`. To use a different file (especially useful for deployment), set an environment variable 
`build`. E.g. `export build='testnet'` to use `config.testnet.ts`. To set environment variables permanently, please refer to your server's documentation, e.g. [https://httpd.apache.org/docs/2.4/env.html] for Apache.
