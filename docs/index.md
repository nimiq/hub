# Nimiq Accounts

Nimiq Accounts provides a unified interface for all Nimiq wallets, accounts and contracts. It is the primary interface
via which users manage their wallets and which provides websites with a consise API to interact with Nimiq accounts.

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
import { default as AccountsManagerClient, RedirectRequestBehavior } from '@nimiq/accounts-manager-client';

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

TODO

### Listening for redirect responses

TODO
