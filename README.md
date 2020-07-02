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
yarn serve
```

Compile and lint continuously in the background for development:

```bash
yarn build --watch
```

Lint and fix files:

```bash
yarn lint
```

Run unit tests:

```bash
yarn test
```

### Build

Compile and minify for production:

```bash
# Using local config
yarn build

# Using testnet config
build=testnet yarn build

# Using mainnet config
build=mainnet yarn build
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

### Internationalization

First of all, a big thank you to all translators!

The Nimiq Hub is fully internationalized and ready for the community to add translations in different languages.

To help translate the Hub, the procedure is as follows:
- Clone this repository.

- The translations are located in the `src/i18n` folder. A translation file for a language is named as the language's
  two letter [ISO 639-1 code](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes) plus file extension `.po`. For
  example, for French with two letter code `fr` the translations are located at `src/i18n/fr.po`. If that file doesn't
  exist yet, i.e. you're starting a new translation, please duplicate `en.po` as starting point, rename it accordingly
  and then add the language to the `SUPPORTED_LANGUAGES` in `i18n-setup.ts`.

- In the language files, the source strings to be translated are between double quotes after the word `msgid`.
  For Example:
  ```
  msgid "Account Created"
  ```
  The translations of these must be provided in the same way, following the word `msgstr`. For Example:
  ```
  msgid "Account Created"
  msgstr "Compte Créé"
  ```
  Please only edit the translations, not the source strings.

- You can test your translations locally by running the demo page as described in section [Run](#run) and then setting a
  language cookie in the served page. To do so, open your browser's developer console (ctrl + shift + c) and input
  `document.cookie = 'lang=<lang>'` where `<lang>` should be replaced by the two letter language code of the language
  you want to test, for example `document.cookie = 'lang=fr'`. After reloading the page, the Hub should be displayed in
  your chosen language. If you struggle setting up the local demo you can ask us to setup an online demo for you after
  opening a pull request.

- Once the file has been fully translated or you are done updating an existing language file, you can open a pull
  request here in github.

- The pull request will then be reviewed and, if all goes well, merged into the master branch and published asap.

#### Additional information

- Multiline translations are possible by inserting line breaks as `\n`. For example:
  ```
  msgid ""
  "Imagine if paying with\n"
  "crypto was easy"
  msgstr ""
  "Imaginez si payer avec\n"
  "de la crypto était facile."
  ```
  Please only insert line breaks into translations for source strings which already include a line break. Otherwise,
  they might break the layout in the Hub or not work as intended.

- Words between curly brackets are variables which must not be translated nor edited. They will be replaced by a value
  during app runtime. The name of the variable should be obvious enough for you to understand what it will be replaced
  by so you can place it at the right position in the translated string. For example:
  ```
  msgid "Cancel {payment}"
  msgstr "Annuler {payment}"
  ```

- Some translations provide two variants depending on the count of something. These variants are split by a `|` which
  must also be preserved in the translation. For example:
  ```
  msgid "Your Account is ready. | Your Accounts are ready."
  msgstr "Votre compte est prêt. | Vos comptes sont prêts."
  ```

- If you're a transifex collaborator, and need some information about how to get started, here are two links for you:
  - How to get started as a translator: https://docs.transifex.com/getting-started-1/translators
  - How translate using the web editor: https://docs.transifex.com/translation/translating-with-the-web-editor
