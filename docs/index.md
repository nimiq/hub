# Nimiq Accounts

Nimiq Accounts provides a unified interface for all Nimiq wallets, accounts and contracts. It is the primary interface
via which users manage their wallets and which provides websites and apps with a consise API to interact with their
users' Nimiq accounts.

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
To start the client, just instantiate the class by passing it the URL of the Accounts Manager to connect to:
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

To find out how to react to redirect responses and retrieve the stored state, go to
[Listening for redirect responses](#listening-for-redirect-responses).

### API Methods

* [Checkout](#checkout)
* [Sign Transaction](#sign-transaction)

#### Checkout
The `checkout()` method allows your site to request a transaction from the user, in which the user selects the sending
account. The transaction is sent to the network during the checkout process in the Accounts Manager, but also returned
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
    sender: string; // Userfriendly sender address
    senderType: Nimiq.Account.Type;
    senderPubKey: Uint8Array; // Serialized sender public key
    recipient: string; // Userfriendly recipient address
    recipientType: Nimiq.Account.Type;
    value: number; // LUNA (nimtoshis)
    fee: number; // LUNA (nimtoshis)
    validityStartHeight: number;
    signature: Uint8Array; // Serialized signature of the sender
    extraData: Uint8Array;
    flags: number;
    networkId: number;
    hash: string; // Transaction hash in base64
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
    appName: 'Nimiq Shop',

    // The keyId of the wallet that the user's account belongs to
    keyId: 'xxxxxxxxx',

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

### Listening for redirect responses
TODO

## Running your own Accounts Manager
TODO
