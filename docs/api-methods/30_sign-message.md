---
title: Sign Message
layout: default
parent: API Reference
nav_order: 30
permalink: /api-reference/sign-message
---

# Sign Message
{: .no_toc }

To let the user sign an arbitrary message with any of their addresses, you can
call `signMessage()` with the following request object. If you do not include
a `signer` property, the user will be prompted to select an address from their
available accounts. The message can be either a string or a Uint8Array byte array.

## Table of Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

## Request

<div class="code-example">
  <p>Result: <span id="output">-</span></p>
  <button id="sign-message-btn" class="btn btn-primary mb-1">Sign Message</button>

  <script
    src="https://cdn.jsdelivr.net/npm/@nimiq/hub-api@v1.2.3/dist/standalone/HubApi.standalone.umd.js"
    integrity="sha256-5X6zryCUAPOnfjLU8tEtJrLdcslA2UI27RsUWnLAxHs=" crossorigin="anonymous"></script>
  <script>
    const hubApi = new HubApi('https://hub.nimiq-testnet.com');

    document.getElementById('sign-message-btn').addEventListener('click', async function(event) {
      const output = document.getElementById('output');

      try {
        const result = await hubApi.signMessage({
          appName: 'Hub API Docs',
          message: 'I like the Nimiq Hub API!',
        });
        output.textContent = 'Message signed by ' + result.signer;
      } catch (error) {
        output.textContent = error.message;
      }
    });
  </script>
</div>
```javascript
const options = {
  appName: 'Hub API Docs',
  message: 'I like the Nimiq Hub API!',
  // See more options in the table below
};

// All client requests are async and return a promise
const signedMessage = await hubApi.signMessage(options);
```

## Options

(On mobile, scroll right to see the whole table.)

| Option | Type | Required? | Description |
|:-------|:-----|:----------|:------------|
| `appName` | string | **yes** | The name of your app, should be as short as possible. |
| `message` | string or Uint8Array | **yes** | The message to sign. Can either be string of valid UTF-8 characters or a byte array to sign arbitrary data. |
| `signer` | string | no | The human-readable address with which to sign. When not passed, an address selector will be displayed to the user. |

## Result

The method returns a `SignedMessage` object containing the following properties:

```javascript
interface SignedMessage {
    signer: string;               // Userfriendly address
    signerPublicKey: Uint8Array;  // The public key of the signer
    signature: Uint8Array;        // Signature for the message
}
```

## Prefixing and Hashing

To prevent users from signing valid transactions or other
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

## Verification

Verifying a signed message with the [Nimiq Core library](https://www.npmjs.com/package/@nimiq/core)
could go like this:

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
