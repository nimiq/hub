# Nimiq Accounts

**Nimiq Accounts** (or **Accounts Manager**) provides a unified interface for all Nimiq wallets, accounts and contracts.
It is the primary interface via which users manage their wallets and which provides websites and apps with a consise API
to interact with their users' Nimiq accounts.

<!-- TOC generated with https://magnetikonline.github.io/markdown-toc-generate/ -->
- [The Accounts Client library](#the-accounts-client-library)
  - [Installation](#installation)
  - [Initialization](#initialization)
    - [Using top-level redirects](#using-top-level-redirects)
  - [API Methods](#api-methods)
    - [Checkout](#checkout)
    - [Sign Transaction](#sign-transaction)
    - [Sign Up](#sign-up)
    - [Login](#login)
    - [Logout](#logout)
    - [Export](#export)
  - [Listening for redirect responses](#listening-for-redirect-responses)
- [Running your own Accounts Manager](#running-your-own-accounts-manager)

## The Accounts Client library

### Installation
The JavaScript client library can either be installed from NPM:
```bash
npm install @nimiq/accounts-manager-client
# or with yarn
yarn add @nimiq/accounts-manager-client
```
or downloaded from the [`client/dist/standalone`](https://github.com/nimiq/accounts/tree/master/client) directory.

To use it, require or import it:
```javascript
const AccountsManagerClient = require('@nimiq/accounts-manager-client');
// or
import AccountsManagerClient from '@nimiq/accounts-manager-client';
```
or include it as a script tag in your page:
```html
<script src="AccountsManagerClient.standalone.umd.js"></script>
```

### Initialization
To start the client, just instantiate the class by passing it the URL of the **Accounts Manager** to connect to:
```javascript
const accountsClient = new AccountsManagerClient('https://accounts.nimiq-testnet.com');
```
> **Note:**
> The client opens a popup window by default for user interactions (new tab on mobile). Popups require that the
> client is called synchronously within the context of a user action, such as a click.

#### Using top-level redirects
If you would rather use top-level redirects instead of popups, you can pass a second parameter to the initialization:
```javascript
import {
    default as AccountsManagerClient,
    RedirectRequestBehavior
} from '@nimiq/accounts-manager-client';

const redirectBehavior = new RedirectRequestBehavior();
const accountsClient = new AccountsManagerClient('https://accounts.nimiq-testnet.com', redirectBehavior);
```

The `RedirectRequestBehavior` can take two optional parameters:

The first is the return URL:
```javascript
const redirectBehavior = new RedirectRequestBehavior('https://url.to/return?to');
```
If no return URL is specified, the current URL without the search parameters is used.

The second optional parameter is an object representing local state to be stored until the request returns:
```javascript
const redirectBehavior = new RedirectRequestBehavior(null, { foo: 'I am stored' });
```

> **Note:**
> Please note that the local state object will be stringified into JSON for storage.

To find out how to react to redirect responses and retrieve the stored state, go to
[Listening for redirect responses](#listening-for-redirect-responses).

### API Methods

* [Checkout](#checkout)
* [Sign Transaction](#sign-transaction)
* [Sign Up](#sign-up)
* [Login](#login)
* [Logout](#logout)
* [Export](#export)

> **Note:**
> All API methods' returned promises can also be rejected with `Error`s for various reasons, e.g. if the user cancels
> the request by closing the popup window or clicking on a cancel button. An error can also occur when the request
> options object contains invalid parameters.

#### Checkout
The `checkout()` method allows your site to request a transaction from the user, in which the user selects the sending
account. The transaction is sent to the network during the checkout process in the **Accounts Manager**, but also returned
from the client (for processing in your site, storage on your server or re-submittal by you).
```javascript
// Create the request options object
const requestOptions = {
    // The name of your app, should be as short as possible.
    appName: 'Nimiq Shop',

    // Userfriendly address of the recipient (your address).
    recipient: 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000',

    // [optional] Nimiq.Account.Type of the recipient.
    // Only required if the recipient is a vesting (1) or HTLC (2) contract.
    // Default: 0 (BASIC)
    //recipientType: 0,

    // Value of the transaction, in LUNA (nimtoshis).
    value: 100 * 1e5, // 100 NIM

    // [optional] Transaction fee in LUNA (nimtoshis).
    // Default: 0
    //fee: 138,

    // [optional] Extra data that should be sent with the transaction.
    // Type: Uint8Array | Nimiq.SerialBuffer
    // Default: new Uint8Array(0)
    //extraData: Nimiq.BufferUtils.fromAscii('Hello world!'),

    // [optional] Nimiq.Transaction.Flag, only required if the transaction is a contract creation.
    // Default: 0
    //flags: 0b1,

    // [optional] Network ID of the Nimiq network that the transaction should be valid in.
    // Defaults to the network that the Keyguard is configured for.
    // Default: 1 for *.nimiq-testnet.com domains, 42 for *.nimiq.com domains.
    //networkId: 42,
};

// All client requests are async and return a promise
const checkoutResult = await accountsClient.checkout(requestOptions);
```
The `checkout()` method returns a promise which resolves to a `SignTransactionResult`:
```javascript
interface SignTransactionResult {
    serializedTx: Uint8Array;
    sender: string;                     // Userfriendly sender address
    senderType: Nimiq.Account.Type;
    senderPubKey: Uint8Array;           // Serialized sender public key
    recipient: string;                  // Userfriendly recipient address
    recipientType: Nimiq.Account.Type;
    value: number;                      // LUNA (nimtoshis)
    fee: number;                        // LUNA (nimtoshis)
    validityStartHeight: number;
    signature: Uint8Array;              // Serialized signature of the sender
    extraData: Uint8Array;
    flags: number;
    networkId: number;
    hash: string;                       // Transaction hash in base64
}
```

#### Sign Transaction
The `signTransaction()` method differs from the checkout in that it requires the request to already include the
sender's `keyId`, `sender` address and the transaction's `validityStartHeight`. The transaction is also not
automatically sent to the network during the process, but only returned to the caller.
```javascript
// Create the request options object
const requestOptions = {
    // The name of your app, should be as short as possible.
    appName: 'Nimiq Safe',

    // The keyId of the wallet that the user's account belongs to
    keyId: 'xxxxxxxx',

    // Userfriendly address of the sender
    sender: 'NQxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx',

    // Userfriendly address of the recipient (your address).
    recipient: 'NQxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx',

    // [optional] Nimiq.Account.Type of the recipient.
    // Only required, if the recipient above is a vesting (1) or HTLC (2) contract.
    // Default: 0 (BASIC)
    //recipientType: 0,

    // Value of the transaction, in LUNA (nimtoshis).
    value: 100 * 1e5, // 100 NIM

    // [optional] Transaction fee in LUNA (nimtoshis).
    // Default: 0
    //fee: 138,

    // [optional] Extra data that should be sent with the transaction.
    // Type: Uint8Array | Nimiq.SerialBuffer
    // Default: new Uint8Array(0)
    //extraData: Nimiq.BufferUtils.fromAscii('Hello world!'),

    // [optional] Nimiq.Transaction.Flag, only required if the transaction is a contract creation.
    // Default: 0
    //flags: 0b1,

    // [optional] Network ID of the Nimiq network that the transaction should be valid in.
    // Defaults to the network that the Keyguard is configured for.
    // Default: 1 for *.nimiq-testnet.com domains, 42 for *.nimiq.com domains.
    //networkId: 42,

    // The transaction's validity start height.
    // A transaction is only valid for 120 blocks after its validityStartHeight.
    // Transactions with a validityStartHeight higher than (current network block height + 1) are rejected and need to
    // be sent again later during their validity window.
    validityStartHeight: 123456,
};

// All client requests are async and return a promise
const signTxResult = await accountsClient.signTransaction(requestOptions);
```
The `signTransaction()` method returns the same `SignTransactionResult` type as the `checkout()` method.

#### Sign Up
The `signup()` method creates a new wallet in the user's **Keyguard** and **Accounts Manager**.
```javascript
// Create the request options object
const requestOptions = {
    // The name of your app, should be as short as possible.
    appName: 'Nimiq Safe',
};

// All client requests are async and return a promise
const newWallet = await accountsClient.signup(requestOptions);
```
The `signup()` method returns a promise which resolves to a `SignupResult`:
```javascript
interface SignupResult {
    keyId: string;          // Automatically generated wallet ID
    label: string;          // The label/name given to the wallet by the user
    type: KeyStorageType;   // 1 for BIP39 Keyguard wallets, 2 for Ledger wallets

    address: {              // During the signup, only the first address is derived
        address: string;    // Userfriendly address
        label: string;      // The label/name given to the address by the user
    };
}
```

#### Login
The `login()` method allows the user to add an existing wallet or legacy account to the **Accounts Manager** by
importing their *Key File*, *Recovery Words* or legacy *Account Access File*. After a wallet has been imported, the
**Accounts Manager** automatically detects active addresses following the
[BIP44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki#account-discovery) method.
```javascript
// Create the request options object
const requestOptions = {
    // The name of your app, should be as short as possible.
    appName: 'Nimiq Safe',
};

// All client requests are async and return a promise
const newWallet = await accountsClient.login(requestOptions);
```
The `login()` method returns a promise which resolves to a `LoginResult`:
```javascript
interface LoginResult {
    keyId: string;          // Automatically generated wallet ID
    label: string;          // The label/name given to the wallet by the user
    type: KeyStorageType;   // 1 for BIP39 Keyguard wallets, 2 for Ledger wallets

    addresses: Array<{      // Array of active addresses detected during login
        address: string;    // Userfriendly address
        label: string;      // The label/name given to the address by the user
    }>;
}
```

#### Logout
The `logout()` method enables a user to remove a wallet or legacy account from the **Keyguard** and
**Accounts Manager**. During the logout process, the user is able to retrieve the wallet's *Key File* or
*Recovery Words* before the key is deleted.
```javascript
// Create the request options object
const requestOptions = {
    // The name of your app, should be as short as possible.
    appName: 'Nimiq Safe',

    // The keyId of the wallet that should be removed
    keyId: 'xxxxxxxx',
};

// All client requests are async and return a promise
const logoutResult = await accountsClient.logout(requestOptions);
```
The `logout()` method returns a promise which resolves to a simple object containing the `success` property:
```javascript
{
    success: true
}
```

#### Export
The `export()` method enables a user to retrieve the *Key File* or *Recovery Words* of a wallet or legacy account.
```javascript
// Create the request options object
const requestOptions = {
    // The name of your app, should be as short as possible.
    appName: 'Nimiq Safe',

    // The keyId of the wallet that the user's account belongs to
    keyId: 'xxxxxxxx',
};

// All client requests are async and return a promise
const exportResult = await accountsClient.export(requestOptions);
```
The `export()` method returns a promise which resolves to a simple object containing the `success` property:
```javascript
{
    success: true
}
```

### Listening for redirect responses
If you expect redirect responses from the **Accounts Manager**, you need to listen for them specifically by passing the
`RequestType` to listen for and your handler functions to the client's `on()` method. The handler functions are called
with three parameters: the result object, the RPC call ID, and the stored local state (as JSON string) that was passed
to the `RedirectRequestBehavior` [during initialization](#using-top-level-redirects).
```javascript
import {
    default as AccountsManagerClient,
    RequestType
} from '@nimiq/accounts-manager-client';

// 1. Initialize an Accounts Manager client instance
const accountsClient = new AccountsManagerClient('<URL>');


// 2. Define your handler functions
const onSuccess = function(result, id, state) {
    console.log("Got result from Accounts Manager:", result);
    console.log("Request RPC ID:", id);
    console.log("Retrieved stored state:": state); // As JSON string
}

const onError = function(error, id, state) {
    console.log("Got error from Accounts Manager:", error);
    console.log("Request RPC ID:", id);
    console.log("Retrieved stored state:": state); // As JSON string
}

// 3. Listen for the redirect request responses you expect
accountsClient.on(RequestType.CHECKOUT, onSuccess, onError);
accountsClient.on(RequestType.SIGNTRANSACTION, onSuccess, onError);
accountsClient.on(RequestType.LOGIN, onSuccess, onError);

// 4. Trigger a check for redirect response data in the URL
accountsClient.init();
```
The available `RequestType`s, corresponding to the methods, are:
```javascript
enum RequestType {
    CHECKOUT,
    SIGNTRANSACTION,
    SIGNUP,
    LOGIN,
    LOGOUT,
    EXPORT,
}
```

## Running your own Accounts Manager
TODO
