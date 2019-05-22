# Nimiq Hub <!-- omit in toc -->

The Nimiq Hub provides a unified interface for
all Nimiq accounts, addresses, and contracts. It is the primary UI for Nimiq users
to manage their accounts and provides websites and apps with a concise API to
interact with their users' Nimiq addresses.

- [The Hub API library](#the-hub-api-library)
    - [Installation](#installation)
    - [Initialization](#initialization)
    - [Usage](#usage)
        - [Using top-level redirects](#using-top-level-redirects)
    - [API Methods](#api-methods)
        - [Checkout](#checkout)
        - [Choose Address](#choose-address)
        - [Sign Transaction](#sign-transaction)
        - [Sign Message](#sign-message)
    - [Account Management](#account-management)
    - [Listening for redirect responses](#listening-for-redirect-responses)
- [Running your own Hub](#running-your-own-hub)
- [Contribute](#contribute)
    - [Setup](#setup)
    - [Run](#run)
    - [Build](#build)
    - [Configuration](#configuration)

## The Hub API library

### Installation

Include the `HubApi` JS library as a script tag in your page:

```html
<!-- From CDN -->
<script src="https://unpkg.com/@nimiq/hub-api@v0.4/dist/standalone/HubApi.standalone.umd.js"></script>
<!-- or -->
<script src="https://cdn.jsdelivr.net/npm/@nimiq/hub-api@v0.4/dist/standalone/HubApi.standalone.umd.js"></script>
```

It can also be installed from NPM:

```bash
npm install @nimiq/hub-api
# or with yarn
yarn add @nimiq/hub-api
```

Then import or require it in your module:

```javascript
import HubApi from '@nimiq/hub-api';
// or
const HubApi = require('@nimiq/hub-api');
```

### Initialization

To start the client, just instantiate the class by passing it the URL of the
**Nimiq Hub** to connect to:

```javascript
// Connect to testnet
const hubApi = new HubApi('https://hub.nimiq-testnet.com');

// Connect to mainnet
const hubApi = new HubApi('https://hub.nimiq.com');
```

### Usage

By default, the client opens a popup window for user interactions. On mobile
devices, a new tab will be opened instead. For simplicity, we will always refer
to popups throughout this documentation.

Popups will be blocked if not opened within the context of an active user
action. Thus, it is required that API methods are called synchronously within
the context of a user action, such as a click. See example below.

```javascript
document.getElementById('checkoutButton').addEventListener('click', function(event){
    hubApi.checkout(/* see details below */);
});
```

For more details about avoiding popup blocking refer to
[this article](https://javascript.info/popup-windows#popup-blocking).

#### Using top-level redirects

> **Note:** To use redirects instead of popups, your app must run under a
> HTTPS domain!

If you prefer top-level redirects instead of popups, you can pass an
instance of `RedirectRequestBehavior` as a second parameter to either the
HubApi initialization or to any API method:

> **Note:** The way to configure top-level redirects will change in an upcoming
> version of the Hub API!

```javascript
const redirectBehavior = new HubApi.RedirectRequestBehavior();

// Pass the behavior as a second parameter to the HubApi
const hubApi = new HubApi(<url>, redirectBehavior);

// Or pass it as a second parameter to any API method
const result = hubApi.checkout(<requestOptions>, redirectBehavior);
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
- [Sign Transaction](#sign-transaction)
- [Sign Message](#sign-message)

> **Note:**
>
> All API methods run asynchronously and thus return promises. Please keep in
> mind that promises can also be rejected for various reasons, e.g. when the user
> cancels the request by closing the popup window or clicking on a cancel
> button.
>
> An error can also occur when the request contains invalid parameters. The request
> promise will be rejected with an `Error` object.

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
    // Type: string | Uint8Array | Nimiq.SerialBuffer
    // Default: new Uint8Array(0)
    //extraData: 'Hello Nimiq!',

    // [optional] Human-readable address of the sender.
    // If the address exists in the user's Hub, this parameter
    // forwards the user directly to the transaction-signing after the
    // balance check.
    // Default: undefined
    //sender: 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000',

    // [optional] Whether to force the submitted sender address
    // If this parameter is true, an exception is thrown when either the
    // submitted sender address does not exist or does not have sufficient
    // balance. When false, the user will be shown the address selector
    // for the above conditions instead.
    // (Only relevant in connection with the `sender` parameter)
    // Default: false
    //forceSender: true,

    // [optional] Nimiq.Transaction.Flag, only required if the transaction
    // creates a contract.
    // Default: Nimiq.Transaction.Flag.NONE (0)
    //flags: Nimiq.Transaction.Flag.CONTRACT_CREATION,

    // [optional] The duration (in number of blocks) that the signed transaction
    // should be valid for. The maximum is 120.
    // Default: 120
    //validityDuration?: number;
};

// All client requests are async and return a promise
const signedTransaction = await hubApi.checkout(requestOptions);
```

The `checkout()` method returns a promise which resolves to a
`SignedTransaction`:

```javascript
interface SignedTransaction {
    serializedTx: string;                  // HEX signed and serialized transaction
    hash: string;                          // HEX transaction hash

    raw: {
        signerPublicKey: Uint8Array;       // Serialized public key of the signer
        signature: Uint8Array;             // Serialized signature of the signer

        sender: string;                    // Human-readable address of sender
        senderType: Nimiq.Account.Type;    // 0, 1, 2 - see recipientType above

        recipient: string;                 // Human-readable address of recipient
        recipientType: Nimiq.Account.Type; // 0, 1, 2 - see above

        value: number;
        fee: number;
        validityStartHeight: number;       // Automatically determined validity
                                           // start height of the transaction
        extraData: Uint8Array;
        flags: number;
        networkId: number;
    }
}
```

The `serializedTx` can be handed to a Nimiq JSON-RPC's `sendRawTransaction` method.
The `raw` object can be handed to the NanoApi's `relayTransaction` method.

#### Choose Address

By using the `chooseAddress()` method, you are asking the user to select one of
their addresses to provide to your website. This can be used for example to find
out which address your app should send funds to.

**Note:** This method should not be used as a login or authentication mechanism,
as it does not provide any security that the user actually owns the provided address!

The method takes a basic request object as its only argument, which must only contain
the `appName` property:

```javascript
const requestOptions = {
    // The name of your app, should be as short as possible.
    appName: 'My App',
};

// All client requests are async and return a promise
const address = await hubApi.chooseAddress(requestOptions);
```

The request's result contains an address string as `address` and a `label`:

```javascript
interface Address {
    address: string;  // Human-readable address
    label: string;    // The address's label (name)
}
```

#### Sign Transaction

The `signTransaction()` method is similar to checkout, but provides a different
UI to the user. The main difference to `checkout()` is that it requires the
request to already include the sender's address as `sender`, as well as the
transaction's `validityStartHeight`. The created transaction will only be
returned to the caller, not sent to the network automatically.

For brevity, most duplicate parameter explanations are omitted here, please
refer to [Checkout](#checkout) for more details.

```javascript
const requestOptions = {
    appName: 'My App',

    // Sender information
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
const signedTransaction = await hubApi.signTransaction(requestOptions);
```

The `signTransaction()` method returns a `SignedTransaction`. See
[Checkout](#checkout) for details.

#### Sign Message

To let the user sign an arbitrary message with any of their addresses, you can
call `signMessage()` with the following request object. If you do not include
a `signer` property, the user will be prompted to select an address from their
available accounts. The message can be either a string or a Uint8Array byte array.

```javascript
const requestOptions = {
    // The name of your app, should be as short as possible.
    appName: 'My App',

    // The message to sign. Can either be string of valid UTF-8 or a
    // byte array to sign arbitrary data
    message: 'String to sign' || new Uint8Array([...]),

    // [optional] The human-readable address with which to sign
    // When not passed, an address selector will be displayed to the user.
    // Default: undefined,
    //signer: 'NQxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx xxxx';
};

// All client requests are async and return a promise
const signedMessage = await hubApi.signMessage(requestOptions);
```

The method returns a `SignedMessage` object containing the following properties:

```javascript
interface SignedMessage {
    signer: string;               // Userfriendly address
    signerPublicKey: Uint8Array;  // The public key of the signer
    signature: Uint8Array;        // Signature for the message
}
```

**Note:** To prevent users from signing valid transactions or other
blockchain-related proofs which could be used to impersonate them, the
Nimiq Keyguard prefixes additional data to the message before signing.
This prefix consists of

- a 23 bytes prefix (`'\x16Nimiq Signed Message:\n'`, available as `HubApi.MSG_PREFIX`)
- the length of the message as a stringified number

This data is then hashed with SHA256 before being signed. Together, this leads
to the following data structure:

```javascript
sign( sha256( '\x16Nimiq Signed Message:\n' + message.length + message ) );
```

Verifying a signed message could go like this:

```javascript
const signature = new Nimiq.Signature(signedMessage.signature);
const publicKey = new Nimiq.PublicKey(signedMessage.signerPublicKey);

// For string messages:
const data = HubApi.MSG_PREFIX
           + message.length
           + message;
const dataBytes = Nimiq.BufferUtils.fromUtf8(data);
const hash = Nimiq.Hash.computeSha256(dataBytes);

// Check signature against the hashed message
const isValid = signature.verify(publicKey, hash);
```

### Account Management

Account management functions of the Nimiq Hub, while available on the HubApi, are
not yet accessible by 3rd-party apps, only by the Nimiq Safe. Developers can however
configure their own builds to accept arbitrary origins for these methods.

[Account Management API Documentation](https://github.com/nimiq/hub/wiki/Account-Management-API)

### Listening for redirect responses

If you configured the HubApi to use
[top-level redirects](#using-top-level-redirects) instead of popups, you need to
follow the four steps below to specifically listen for the redirects from the
**Hub** back to your site, using the `on()` method.

Your handler functions will be called with two parameters: the result object and
the stored data object as it was passed to the
`RedirectRequestBehavior` [during initialization](#using-top-level-redirects).

```javascript
// 1. Initialize an Hub client instance
const hubApi = new HubApi(/* ... */);

// 2. Define your handler functions
const onSuccess = function(result, storedData) {
    console.log("Got result from Hub:", result);
    console.log("Retrieved stored data:": storedData);
}

const onError = function(error, storedData) {
    console.log("Got error from Hub:", error);
    console.log("Retrieved stored data:": storedData);
}

// 3. Listen for the redirect responses you expect
hubApi.on(HubApi.RequestType.CHECKOUT, onSuccess, onError);
hubApi.on(HubApi.RequestType.SIGN_TRANSACTION, onSuccess, onError);
hubApi.on(HubApi.RequestType.CHOOSE_ADDRESS, onSuccess, onError);

// 4. After setup is complete, check for a redirect response
hubApi.checkRedirectResponse();
```

<!-- QUESTION/IDEA The RPC ID should be explained.
     Can the dev retrieve the ID before triggering the API method so that later
     on request and result can be aligned?
     If not, what's the potential use of the ID?
     I suggestion to remove it, or at least make the ID third and thus optional.
     -->
The available `RequestType`s, corresponding to the API methods, are:

```javascript
enum HubApi.RequestType {
    CHECKOUT = 'checkout',
    CHOOSE_ADDRESS = 'choose-address',
    SIGN_TRANSACTION = 'sign-transaction',
    SIGN_MESSAGE = 'sign-message',
}
```

## Running your own Hub

TODO

If you want to run your own instance of Hub, you also need to run
an instance of the [Keyguard](https://github.com/nimiq/keyguard-next/).

## Contribute

To get started with working on the source code, pull the code and install the dependencies:

### Setup

```bash
git clone https://github.com/nimiq/hub.git
cd hub
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

- keyguardEndpoint: The location of your keyguard instance.
- network: The network you want to use. Possible values are 'main', 'test' and
  'dev'. You can use the constants (see default configs).
- networkEndpoint: The location of the network iframe instance you want to use.
- privilegedOrigins: An array of origins with special access rights, nameley
  permission to use iframe methods like `list()`.
- redirectTarget: In case of empty referrer or absence of request, the user is
  redirected to this page.

The default config file is `config.local.ts`. To use a different file
(especially useful for deployment), set an environment variable
`build`. E.g. `export build='testnet'` to use `config.testnet.ts`. To set
environment variables permanently, please refer to your server's documentation,
e.g. [for Apache](https://httpd.apache.org/docs/2.4/env.html).
