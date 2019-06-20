---
title: Installation
layout: default
nav_order: 20
permalink: /installation
---

# Installation
{: .no_toc }

## Table of Contents
{: .no_toc .text-delta }

1. TOC
{:toc}

## Script from CDN

Include the Hub API library as a script in your page:

```html
<script
  src="https://cdn.jsdelivr.net/npm/@nimiq/hub-api@v1.0/dist/standalone/HubApi.standalone.umd.js"
  integrity="sha256-HZuohwzM5nRdRQh3HLpAcYGbpNe6PtqZRyK+VvUI+nU=" crossorigin="anonymous"></script>
```

This will make the `HubApi` object available globally on your site.

You can also `import` from the CDN as an ES6 module:

```html
<script type="module">
  import HubApi from 'https://cdn.jsdelivr.net/npm/@nimiq/hub-api@v1.0/dist/standalone/HubApi.standalone.es.js';

  // Your code here...
</script>
```

## NPM and Bundlers

The Hub API can be installed from NPM to use with bundlers (for example Webpack, Rollup, etc.):

```bash
npm install --save @nimiq/hub-api
# or with yarn
yarn add @nimiq/hub-api
```

Then simply import or require it in your module:

```javascript
import HubApi from '@nimiq/hub-api';
// or
const HubApi = require('@nimiq/hub-api');
```

---

Next: [Usage](/hub/usage)
