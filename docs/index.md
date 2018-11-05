# Nimiq Accounts

**Nimiq Accounts** (or **Accounts Manager**) provides a unified interface for all Nimiq wallets, accounts, and contracts.
It is the primary UI for Nimiq users to manage their wallets and provides websites and apps with a concise API
to interact with their users' Nimiq accounts.
<!-- VSC markdownlinter keeps the TOC up-to-date automatically,
     but also always puts the top-level heading (which is the name of the doc) into the TOC
     which looks strange. Reported an issue. -->
- [Nimiq Accounts](#nimiq-accounts)
    - [The Accounts Client library](#the-accounts-client-library)
        - [Installation](#installation)
        - [Initialization](#initialization)
            - [Using top-level redirects](#using-top-level-redirects)
        - [API Methods](#api-methods)
            - [Checkout](#checkout)
            - [Sign transaction](#sign-transaction)
            - [Signup](#signup)
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
or downloaded from the [client/dist/standalone](https://github.com/nimiq/accounts/tree/master/client) directory.
<!-- FIXME link should point to dist/standalone;
     but folder does also not exist in repo yet -->
<!-- NOTE removed backticks so it actually looks like a link -->

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
<!-- FIXME no 'standalone.umd.js' in repository -->

### Initialization
To start the client, just instantiate the class by passing it the URL of the **Accounts Manager** to connect to:
```javascript
const accountsClient = new AccountsManagerClient('https://accounts.nimiq-testnet.com');
```
> **Note:**
> By default, the client opens a popup window for user interactions.
> On mobile devices, a tab will be opened instead.
> For simplicity, we will always refer to a popup throughout this documentation.
> Popups will be blocked if not called within the context of a user action.
> Thus, it's require that API methods need to be called synchronously within the context of a user action, such as a click. See example below.
<!-- IDEA drop 'synchronously', it might be confusing, within is enough -->
<!-- CHECK example on user action below -->
```javascript
document.getElementById('#checkoutButton').addEventListener('click', function(event){
    const accountsClient = new AccountsManagerClient('https://accounts.nimiq-testnet.com');
    accountsClient.checkout(/* see details below */);
});
```

#### Using top-level redirects
If you prefer top-level redirects instead of popups, you can pass a second parameter to the initialization:
```javascript
import AccountsManagerClient from '@nimiq/accounts-manager-client';

const redirectBehavior = new AccountsManagerClient.RedirectRequestBehavior();
const accountsClient = new AccountsManagerClient('https://accounts.nimiq-testnet.com', redirectBehavior);
```

The `RedirectRequestBehavior` can take two optional parameters:

The first is the return URL:
```javascript
const redirectBehavior = new RedirectRequestBehavior('https://url.to/return?to');
```
If no return URL is specified, the current URL without parameters will be used.

The second optional parameter is an object representing local state to be stored until the request returns:
```javascript
const redirectBehavior = new RedirectRequestBehavior(null, { foo: 'I am stored' });
```

> **Note:**
> The local state object will be serialized to JSON for storage.

For details on how to listen for redirect responses and retrieve the stored state,
see [Listening for redirect responses](#listening-for-redirect-responses).

### API Methods

* [Checkout](#checkout)
* [Sign Transaction](#sign-transaction)
* [Signup](#signup)
* [Login](#login)
* [Logout](#logout)
* [Export](#export)

> **Note:**
> All API methods run asynchronously and thus return promises.
> Please keep in mind that promises can also be rejected for various reasons,
> e.g. if the user cancels the request by closing the popup window or clicking on a cancel button.
> An error can also occur when the request contains invalid parameters.
> The `Error` object will be passed on to the `reject` method.

#### Checkout
The `checkout()` method allows your site to request a transaction. In turn, this will open a popup
for the user to select the account to send from&mdash;or cancel the request as well.
During the checkout process, the signed transaction is sent (relayed) to the network by the
**Accounts Manager**, but also returned to the caller,
e.g. for processing in your site, storage on your server or re-submittal by you.
<!-- IDEA (added below) using the "account number" term than "user-friendly address".
     (see terminology, more related situations further down.
     If it needs to be address, I'd opt for "human-readable address")
     Changed words to lowercase that are not accumulations, such as luna or basic (terminology) -->
```javascript
const requestOptions = {
    // The name of your app, should be as short as possible.
    appName: 'Nimiq Shop',

    // The account number of the recipient (your address).
    recipient: 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000',

    // [optional] Nimiq.Account.Type of the recipient.
    // Only required if the recipient is a vesting (1) or HTLC (2) contract.
    // Default: 0 (basic account)
    //recipientType: 0,

    // Value of the transaction, in luna.
    value: 100 * 1e5, // 100 NIM

    // [optional] Transaction fee in luna.
    // Default: 0
    //fee: 138,

    // [optional] Extra data that should be sent with the transaction.
    // Type: Uint8Array | Nimiq.SerialBuffer
    // Default: new Uint8Array(0)
    //extraData: Nimiq.BufferUtils.fromAscii('Hello Nimiq!'),

    // [optional] Nimiq.Transaction.Flag, only required if the transaction creates a contract.
    // Default: 0
    //flags: 0b1,

    // [optional] Network ID of the Nimiq network that the transaction should be valid in.
    // Defaults to the network that the Accounts Manager is configured for.
    // Default: 1 for *.nimiq-testnet.com domains, 42 for *.nimiq.com domains.
    //networkId: 42,
};

// All client requests are async and return a promise
const checkoutResult = await accountsClient.checkout(requestOptions);
```
The `checkout()` method returns a promise which resolves to a `SignTransactionResult`:
```javascript
interface SignTransactionResult {
    serializedTx: Uint8Array;           // the signed, serialized transaction
    sender: string;                     // Account number of sender
    senderType: Nimiq.Account.Type;     // 0, 1, 2 - see recipientType above
    senderPubKey: Uint8Array;           // Serialized public key of sender
    recipient: string;                  // Account number of recipient
    recipientType: Nimiq.Account.Type;  // 0, 1, 2 - see above
    value: number;
    fee: number;
    validityStartHeight: number;        // See section below
    signature: Uint8Array;              // Serialized signature of the sender
    extraData: Uint8Array;
    flags: number;
    networkId: number;
    hash: string;                       // Transaction hash in base64
}
```
<!-- FIXME mentions flag for contract creation.
     I think this needs more explanation, are there other flags?
     Provide constants for flags? -->

#### Sign transaction
The `signTransaction()` method is used within the checkout process.
The main difference to `checkout()` is that it requires the request to already include the
sender's wallet ID and account number in `keyId` and `sender` respectively,
as well as the transaction's `validityStartHeight`.
The created transaction will only be returned to the called, not send to the network automatically.
Most duplicate explanation are omitted here, please refer to [checkout](#checkout) for details.

<!-- IDEA removed duplicated comments for DRY doc. Referred to checkout doc. -->
```javascript
const requestOptions = {
    appName: 'Nimiq Safe',
    keyId: 'xxxxxxxx',

    // Account number of the sender and recipient
    sender: 'NQxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx',
    recipient: 'NQxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx',

    value: 100 * 1e5, // 100 NIM

    // [optional] attributes, see checkout method for details
    //senderType: 0,
    //recipientType: 0,
    //fee: 138,
    //extraData: Nimiq.BufferUtils.fromAscii('Hello Nimiq!'),
    //flags: 0b1,
    //networkId: 42,

    // The transaction's validity start height.
    // A transaction is only valid for 120 blocks after its validityStartHeight.
    // Transactions with a validityStartHeight higher than (current network block height + 1)
    // are rejected and need to be sent again later during their validity window.
    validityStartHeight: 123456,
};

// All client requests are async and return a promise
const signTxResult = await accountsClient.signTransaction(requestOptions);
```

The `signTransaction()` method returns a `SignTransactionResult` as well.
See [checkout](#checkout) for details.

#### Signup
<!-- IDEA changed to Signup because that's how the method is called.
     Would suggest to change to signUp() and SignUpResult at first
     but then we have to also change to logIn() and logOut(), so signup() might be the best compromise. -->
The `signup()` method creates a new wallet in the **Accounts Manager**.
The user will chose an Identicon, set a label (optional), and backup the wallet (optional).
<!-- CHECK Added previous phrase. Correct? Still like that? -->
```javascript
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

    type: KeyStorageType;   // 0 for single-address (legacy) accounts,
                            // 1 for BIP39 Keyguard wallets,
                            // 2 for Ledger wallets

    address: {              // During the signup, only the first account is derived
        address: string;    // Account number of first account
        label: string;      // The label/name given to the account by the user
    };
}
```
<!-- QUESTION/IDEA noticed it's getting a bit weird with account number vs. address.
     Seems like the code is using address while all official communication and FAQs use account and account number.
     Would be good to stick with one, I'd suggest the official Nimiq terminology,
     but I understand that among crypto people address is more common. Suggestion:
     account: {
         accountNumber: string,
         label: string
     }
     -->
<!-- CHECK Tried to explain BIP39, as it's used above. Is this the right thing?
     It's about the mnemonic phrase. Is "keyStorageType": "mnemonic phrase" what is intended here? -->
> Note: BIP39 refers to a standard procedure of generating a list of natural words
> to store and regenerate a private key.
> More details can be found [here](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki).

#### Login
The `login()` method allows the user to add an existing wallet to the **Accounts Manager** by
importing their *Key File*, *Recovery Words* or *Account Access File*.
After a wallet has been imported, the **Accounts Manager** automatically detects active accounts following the
[BIP44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki#account-discovery) method.
<!-- CHECK Removed 'legacy' above. I think we plan to have Account Access Files also in the future and
     from the dev's point of view, there is no difference handling them, thus,
     I would suggest not to put too much emphasis on it. -->
```javascript
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

    type: KeyStorageType;   // 0 for single-address (legacy) accounts,
                            // 1 for BIP39 Keyguard wallets,
                            // 2 for Ledger wallets

    addresses: Array<{      // Array of active addresses detected during login
        address: string;    // Userfriendly address
        label: string;      // The label/name given to the address by the user
    }>;
}
```
<!-- NAMING named 'keyId' and described as wallet ID.
     Similar to 'user-friendly address' and 'Account Number', 'address' and 'account'.
     We should find a general solution to this.
     I think the only possible solution is to use the the official terminology consistently also inside the code.
     I.e. use "accounts" and "accountNumber" above and "walletId" above and below. Doable?
     {
         walletId: string,
         label: string,
         type: KeyStorageType,
         accounts: [{
            accountNumber: string,
            label: string
         }]
     }
     -->

#### Logout
The `logout()` method removes a wallet from the **Accounts Manager**.
During the logout process, the user can retrieve the wallet's *Key File* or *Recovery Words* before the key is deleted.
<!-- CHECK Can we skip the separation of "wallet or legacy account"? Does it make a difference?
     Ideally, a dev doesn't need to be bothered with this and just use the API in the same way. -->
<!-- NAMING using "Key File", which is the new "Account Access File". Need to update terminology.
     I suggest using "Wallet File" to be consistent with doc and comments speaking about a wallet. -->
```javascript
const requestOptions = {
    // The name of your app, should be as short as possible.
    appName: 'Nimiq Safe',

    // The ID of the wallet that should be removed
    keyId: 'xxxxxxxx',
};

// All client requests are async and return a promise
const logoutResult = await accountsClient.logout(requestOptions);
```
<!-- NAMING similarly, ideally use walletId above-->

The `logout()` method returns a promise which resolves to a simple object containing the `success` property:
```javascript
{
    success: true
}
```
<!-- QUESTION Shouldn't it reject on failure instead of returning success: true/false? -->

#### Export
Using the `export()` method, a user can retrieve (export) the *Key File* or *Recovery Words* of a wallet.
```javascript
const requestOptions = {
    // The name of your app, should be as short as possible.
    appName: 'Nimiq Safe',

    // The ID of the wallet that the user's account belongs to
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
<!-- see above, success: false vs reject? -->

### Listening for redirect responses
<!-- CHECK updated below, redirect is expected when configured to use redirects instead of popup. -->
If you configured the **Accounts Manager** to use [top-level redirects](#using-top-level-redirects),
you need to follow the four steps shown in the code example below
to specifically listen for the top-level redirects returning to your site using the `on()` method.
Your handler functions will be called with three parameters:
the result object, the RPC call ID, and the stored local state object (as JSON string)
as it was passed to the `RedirectRequestBehavior` [during initialization](#using-top-level-redirects).
<!-- FIXME I think it's inconsistent to return a JSON string instead of the objected passed in.
     Even if it was serialized in between. -->
```javascript
import AccountsManagerClient from '@nimiq/accounts-manager-client';

// 1. Initialize an Accounts Manager client instance with the URL to connect to
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
const RequestType = AccountsManagerClient.RequestType;

accountsClient.on(RequestType.CHECKOUT, onSuccess, onError);
accountsClient.on(RequestType.SIGNTRANSACTION, onSuccess, onError);
accountsClient.on(RequestType.LOGIN, onSuccess, onError);

// 4. After setup is complete, start the Account Manager client
accountsClient.init();
```
<!-- QUESTION/IDEA The RPC ID should be explained.
     Can the dev retrieve the ID before triggering the API method so that later on request and result can be aligned?
     If not, what's the potential use of the ID?
     I suggestion to make the ID third and thus optional. -->
The available `RequestType`s, corresponding to the API methods, are:
```javascript
enum AccountsManagerClient.RequestType {
    CHECKOUT = 'checkout',
    SIGNTRANSACTION = 'sign-transaction',
    SIGNUP = 'signup',
    LOGIN = 'login',
    LOGOUT = 'logout',
    EXPORT = 'export',
}
```
<!-- FIXME change SIGNTRANSACTION to SIGN_TRANSACTION and adjust above. -->

## Running your own Accounts Manager
TODO
