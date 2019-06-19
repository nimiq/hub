# Nimiq Hub <!-- omit in toc -->

The Nimiq Hub provides a unified interface for all Nimiq accounts, addresses, and
contracts. It is the primary UI for Nimiq users to manage their accounts and provides
websites and apps with a concise API to interact with their users’ Nimiq addresses.

- [Hub API](#hub-api)
- [Running your own Hub](#running-your-own-hub)
- [Contribute](#contribute)
    - [Setup](#setup)
    - [Run](#run)
    - [Build](#build)
    - [Configuration](#configuration)

## Hub API

The documentation for the Hub API is at https://nimiq.github.io/hub.

## Running your own Hub

TODO

If you want to run your own instance of Hub, you also need to run
an instance of the [Keyguard](https://github.com/nimiq/keyguard/).

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
