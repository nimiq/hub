---
title: Checkout
layout: default
parent: API Reference
nav_order: 10
permalink: /api-reference/checkout
---

# Checkout
{: .no_toc }

The `checkout()` method allows your site to request a transaction from the user.
This will open a popup for the user to select the address to send from &mdash;
or cancel the request. During the payment process, the signed transaction is
sent (relayed) to the network but also returned to the caller, e.g. for
processing in your site, storage on your server or re-submittal.

## Table of Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

## Request

<div class="code-example">
  <p>Result: <span id="output">-</span></p>
  <button id="checkout-btn" class="btn btn-primary mb-1">Checkout</button>

  <script
    src="https://cdn.jsdelivr.net/npm/@nimiq/hub-api@v1.0/dist/standalone/HubApi.standalone.umd.js"
    integrity="sha256-HZuohwzM5nRdRQh3HLpAcYGbpNe6PtqZRyK+VvUI+nU=" crossorigin="anonymous"></script>
  <script>
    const hubApi = new HubApi('https://hub.nimiq-testnet.com');

    document.getElementById('checkout-btn').addEventListener('click', async function(event) {
      const output = document.getElementById('output');

      try {
        const result = await hubApi.checkout({
          appName: 'Hub API Docs',
          recipient: 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000',
          value: 3.14 * 1e5, /* 3.14 NIM */
        });
        output.textContent = 'Checkout complete, transaction sent!';
      } catch (error) {
        output.textContent = error.message;
      }
    });
  </script>
</div>
```javascript
const options = {
  appName: 'Hub API Docs',
  recipient: 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000',
  value: 3.14 * 1e5, /* 3.14 NIM */
  // See more options in the table below
};

// All client requests are async and return a promise
const signedTransaction = await hubApi.checkout(options);
```

## Options

(On mobile, scroll right to see the whole table.)

| Option | Type | Required? | Description |
|:-------|:-----|:----------|:------------|
| `appName` | string | **yes** | The name of your app, should be as short as possible. |
| `recipient` | string | **yes** | The human-readable address of the recipient (your shop/app). |
| `value` | number | **yes** | Value of the transaction, in Luna. |
| `shopLogoUrl` | string | no | An image URL. Must be on the same origin as the request is sent from. Should be square and at least 146x146 px. |
| `fee` | number | no | Transaction fee in luna. Default: 0 |
| `extraData` | string or Uint8Array | no | Extra data that should be sent with the transaction. |
| `sender` | string | no | Human-readable address of the sender. If the address exists in the user's Hub and has enough balance, the address selection is skipped. |
| `forceSender` | boolean | no | Whether to force the submitted sender address. If this option is `true`, an exception is thrown when either the sender address does not exist or does not have sufficient balance. When `false` (default), the user will be shown the address selector instead. (Only relevant in connection with the `sender` option.) |
| `validityDuration` | number | no | The duration (in number of blocks) that the signed transaction should be valid for. The maximum and default is 120. |
| `flags` | number | no | A [`Nimiq.Transaction.Flag`](https://nimiq-network.github.io/developer-reference/chapters/transactions.html#extended-transaction), only required if the transaction should create a contract. |
| `recipientType` | number | no | The [`Nimiq.Account.Type`](https://nimiq-network.github.io/developer-reference/chapters/accounts-and-contracts.html#contracts) of the recipient. Only required if the transaction should create a contract. |

## Result

The `checkout()` method returns a promise which resolves to a `SignedTransaction`:

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
