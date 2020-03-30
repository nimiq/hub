---
title: Create Cashlink
layout: default
parent: API Reference
nav_order: 15
permalink: /api-reference/create-cashlink
---

# Create Cashlink
{: .no_toc }

A Cashlink is a special form of sending NIM in form of a link. All the information is included in the link, non is stored on third-party servers or the clouds -- it's truly non-custodial.
The `createCashlink()` method creates such a link and charges it with NIM.

This will open a pop-up for the user to select the address to send from &mdash;
or cancel the request. During the payment process, the signed transaction is
sent (relayed) to the network but also returned to the caller, e.g. for
processing in your site, storage on your server or re-submittal.

## Table of Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

## Request

<div class="code-example">
  <button id="create-cashlink-btn" class="btn btn-primary mb-1">Create a Cashlink</button>
  <p>Result: <span id="output">-</span></p>

  <script
    src="https://cdn.jsdelivr.net/npm/@nimiq/hub-api@v1.0/dist/standalone/HubApi.standalone.umd.js"
    integrity="sha256-HZuohwzM5nRdRQh3HLpAcYGbpNe6PtqZRyK+VvUI+nU=" crossorigin="anonymous"></script>
  <script>
    const hubApi = new HubApi('https://hub.nimiq-testnet.com');

    document.getElementById('create-cashlink-btn').addEventListener('click', async function(event) {
      const output = document.getElementById('output');

      try {
        const result = await hubApi.createCashlink({
          appName: 'Hub API Docs',
          value: 3.14 * 1e5, // 3.14 NIM
          returnLink: true,
        });
        output.textContent = `Cashlink created: ${result.link}`;
      } catch (error) {
        output.textContent = error.message;
      }
    });
  </script>
</div>

```javascript
const options = {
  appName: 'Hub API Docs', // required
  value: 3.14 * 1e5, // 3.14 NIM
  returnLink: true,
  // More options in the table below
};

// All client requests are async and return a promise
const result = await hubApi.createCashlink(options);
```

## Options

(On mobile, scroll right to see the whole table.)

| Option | Type | Required? | Description |
|:-------|:-----|:----------|:------------|
| `appName` | string | **yes** | The name of your app, should be as short as possible. |
| `value` | number | no | Value to be loaded onto the Cashlink, in Luna. |
| `message` | string | no | A message to be included into the Cashlink. Can be changed by the user. |
| `autoTruncateMessage` | boolean | no | A message to be included into the Cashlink. Can be changed by the user. |
| `senderAddress` | string | no | Preset the address the Cashlink should be filled from. If it doesn't exists, all available addresses are shown. |
| `returnLink` | boolean | no | As the Cashlink is similar to cash (who get's the hands on it can use it), the user will handle it confidentially. But you can also request to return the create Cashlink with this flag. Default: false. |
| `skipSharing` | boolean | no | If you sent `returnLink` to `true`, you can also set this flag. If set, the dialog will skip the section to share the Cashlink after it has been created. Default: false. |

## Result

The `createCashlink()` method returns a promise which resolves to a `Cashlink` instance:

```javascript
interface Cashlink {
    address: string;       // Human-readable funding address
    message: string;
    value: number;         // In Luna
    status: CashlinkState; // See below
    theme: CashlinkTheme;  // See below
    link?: string;         // the created Cashlink
                           // if returnLink was set to true
}

enum CashlinkState {
    UNKNOWN = -1,
    UNCHARGED = 0,
    CHARGING = 1,
    UNCLAIMED = 2,
    CLAIMING = 3,
    CLAIMED = 4,
}

enum CashlinkTheme {
    UNSPECIFIED, // Equivalent to theme being omitted
    STANDARD,
    CHRISTMAS,
    LUNAR_NEW_YEAR,
    GENERIC,
    BIRTHDAY, // More will be added in the future
}
```

When the resulting link is opened in a browser, the recipient can claim the NIM. Thus, Cashlinks are a great tool to on-board users that don't have a Nimiq address yet. See [Manage Cashlink](manage-cashlink) to redeem a Cashlink programmatically.
