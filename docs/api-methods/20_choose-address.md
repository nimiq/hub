---
title: Choose Address
layout: default
parent: API Reference
nav_order: 20
permalink: /api-reference/choose-address
---

# Choose Address
{: .no_toc }

By using the `chooseAddress()` method, you are asking the user to select one of
their addresses to provide to your website. This can be used for example to find
out which address your app should send funds to.

> **Note:** This method should not be used as a login or authentication mechanism,
> as it does not provide any security that the user actually owns the provided address!

## Table of Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

## Request

<div class="code-example">
  <p>Result: <span id="output">-</span></p>
  <button id="choose-address-btn" class="btn btn-primary mb-1">Choose Address</button>

  <script
    src="https://cdn.jsdelivr.net/npm/@nimiq/hub-api@v1.2.3/dist/standalone/HubApi.standalone.umd.js"
    integrity="sha256-5X6zryCUAPOnfjLU8tEtJrLdcslA2UI27RsUWnLAxHs=" crossorigin="anonymous"></script>
  <script>
    const hubApi = new HubApi('https://hub.nimiq-testnet.com');

    document.getElementById('choose-address-btn').addEventListener('click', async function(event) {
      const output = document.getElementById('output');

      try {
        const result = await hubApi.chooseAddress({
          appName: 'Hub API Docs',
        });
        output.textContent = result.address + ' (' + result.label + ')';
      } catch (error) {
        output.textContent = error.message;
      }
    });
  </script>
</div>
```javascript
const options = {
  appName: 'Hub API Docs',
};

// All client requests are async and return a promise
const addressInfo = await hubApi.chooseAddress(options);
```

## Options

The `appName` is the only parameter for this request.

(On mobile, scroll right to see the whole table.)

| Option | Type | Required? | Description |
|:-------|:-----|:----------|:------------|
| `appName` | string | **yes** | The name of your app, should be as short as possible. |

## Result

The request's result contains an address string as `address` and a `label`:

```javascript
interface Address {
    address: string;  // Human-readable address
    label: string;    // The address's label (name)
}
```
