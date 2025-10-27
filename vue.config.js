const CopyWebpackPlugin = require('copy-webpack-plugin');
// const SriPlugin = require('webpack-subresource-integrity');
const WriteFileWebpackPlugin = require('write-file-webpack-plugin');
const ScriptExtHtmlWebpackPlugin = require('script-ext-html-webpack-plugin');
const path = require('path');
const fs = require('fs');
const createHash = require('crypto').createHash;
const dotenv = require('dotenv');
// const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const PoLoaderOptimizer = require('webpack-i18n-tools')();

const crypto = require('crypto');

// Fix build for Node version with OpenSSL 3
const origCreateHash = crypto.createHash;
crypto.createHash = (alg, opts) => {
    return origCreateHash(alg === 'md4' ? 'md5' : alg, opts);
};

const buildName = process.env.NODE_ENV === 'production'
    ? process.env.build
    : 'local';

if (!buildName) throw new Error('Please specify the build config with the `build` environment variable');

const domain = buildName === 'mainnet'
    ? 'https://hub.nimiq.com'
    : buildName === 'testnet'
        ? process.env.VUE_APP_HUB_URL
        : 'http://localhost:8080';

const browserWarningTemplate = fs.readFileSync(
    path.join(__dirname, 'node_modules/@nimiq/browser-warning/dist/browser-warning.html.template'));

const browserWarningIntegrityHash = `sha256-${createHash('sha256')
    .update(fs.readFileSync(path.join(__dirname, 'node_modules/@nimiq/browser-warning/dist/browser-warning.js')))
    .digest('base64')}`;
const bitcoinJsIntegrityHash = `sha256-${createHash('sha256')
    .update(fs.readFileSync(path.join(__dirname, 'public/bitcoin/BitcoinJS.min.js')))
    .digest('base64')}`;

// Accessible within client code via process.env.VUE_APP_BITCOIN_JS_INTEGRITY_HASH,
// see https://cli.vuejs.org/guide/mode-and-env.html#using-env-variables-in-client-side-code
process.env.VUE_APP_BITCOIN_JS_INTEGRITY_HASH = bitcoinJsIntegrityHash;

// For production builds, still include .env.development.local in process.env if it's a build with the local/development
// config. For development builds (i.e. yarn serve), they are included automatically, see:
// https://cli.vuejs.org/guide/mode-and-env.html#environment-variables
if (process.env.NODE_ENV === 'production' && buildName === 'local') {
    const devEnvironmentVariables = dotenv.parse(fs.readFileSync(path.join(__dirname, '.env.development.local')));
    for (const [key, value] of Object.entries(devEnvironmentVariables)) {
        if (!key.startsWith('VUE_APP_')) continue;
        process.env[key] = value;
    }
}

console.log('Building for:', buildName);

const configureWebpack = {
    plugins: [
        // ...(process.env.NODE_ENV === 'production' ? [new SriPlugin({
        //     hashFuncNames: ['sha256'],
        // })] : []),
        new CopyWebpackPlugin({ patterns: [
            {
                from: 'node_modules/@nimiq/browser-warning/dist/browser-warning.js*',
                to: './',
                flatten: true,
            },
            {
                from: 'node_modules/@nimiq/vue-components/dist/iqons.min.*.svg',
                to: './img/',
                flatten: true,
            },
            {
                from: 'node_modules/@nimiq/vue-components/dist/NimiqVueComponents.umd.min.lang-*.js',
                to: './js/',
                flatten: true,
                transformPath(path) {
                    // The bundled NimiqVueComponents.umd.js tries to load the the non-minified files
                    return path.replace('.min', '');
                },
            },
            {
                from: 'node_modules/@nimiq/core',
                to: `./nimiq/`,
            },
        ]}),
        new WriteFileWebpackPlugin(),
        new PoLoaderOptimizer(),
        // new BundleAnalyzerPlugin(),
    ],
    // Resolve config for yarn build
    resolve: {
        alias: {
            config: path.join(__dirname, `src/config/config.${buildName}.ts`)
        }
    },
    // Fix sourcemaps (https://www.mistergoodcat.com/post/the-joy-that-is-source-maps-with-vuejs-and-typescript)
    devtool: 'source-map', // exact mapping; slow to build; small; enabled code minification and extracted maps
    // TODO: 'eval-source-map' temporarily removed for webpack-i18n-tools, will be fixed in future versions
    node: {
        // Disable most Node polyfills, but enable stream for ethers.js crypto dependencies
        stream: true,
        // Disable others
        fs: false,
        net: false,
        tls: false,
    },
    output: {
        crossOriginLoading: 'anonymous',
        devtoolModuleFilenameTemplate: info => {
            let $filename = 'sources://' + info.resourcePath;
            if (info.resourcePath.match(/\.vue$/) && !info.query.match(/type=script/)) {
                $filename = 'webpack-generated:///' + info.resourcePath + '?' + info.hash;
            }
            return $filename;
        },
        devtoolFallbackModuleFilenameTemplate: 'webpack:///[resource-path]?[hash]',
    },
    externals: {
        // We use a pre-built bundle for BitcoinJS (see public/bitcoin/BitcoinJS.min.js), also including a polyfill for
        // node's 'buffer'. BitcoinJS is bundled separately via browserify for handling of polyfills of node natives.
        // Everywhere we use BitcoinJS, we load it first on demand via BitcoinJSLoader which exposes BitcoinJS as global
        // variable. To instruct webpack to not bundle BitcoinJS and Buffer but use the global BitcoinJS(.Buffer), we
        // mark them as external here via the option 'root' which means it should use the value specified in the
        // following expression (see documentation at https://v4.webpack.js.org/configuration/externals/). However,
        // because we load BitcoinJS only asynchronously on demand, we have to apply a hack to avoid Webpack caching the
        // dependency while it's still undefined. Instead, we ensure the export is always re-evaluated to the current
        // global variable BitcoinJS by overwriting the exports of the cached module as getter. Note that we access the
        // module as arguments[0] in the expression, because it's named differently in the minified production code and
        // the served development version. To see how this plays together with the webpack runtime, have a look at how
        // the dependency is emitted in the generated code and __webpack_require__'s implementation:
        // https://devtools.tech/blog/understanding-webpacks-require---rid---7VvMusDzMPVh17YyHdyL
        'bitcoinjs-lib': 'root Object.defineProperty(arguments[0], \'exports\', { get: () => BitcoinJS }).exports',
        'buffer': 'root Object.defineProperty(arguments[0], \'exports\', { get: () => BitcoinJS }).exports',
    },
};

const pages = {
    index: {
        // entry for the page
        entry: 'src/main.ts',
        // the source template
        template: 'public/index.html',
        // insert browser warning html template
        browserWarningTemplate,
        browserWarningIntegrityHash,
        domain,
        // output as dist/index.html
        filename: 'index.html',
        // chunks to include on this page, by default includes
        // extracted common chunks and vendor chunks.
        chunks: ['chunk-vendors', 'chunk-common', 'index']
    },
    iframe: {
        // entry for the page
        entry: 'src/iframe.ts',
        // the source template
        template: 'public/iframe.html',
        // output as dist/iframe.html
        filename: 'iframe.html',
        // chunks to include on this page, by default includes
        // extracted common chunks and vendor chunks.
        chunks: ['chunk-vendors', 'chunk-common', 'iframe']
    },
    'cashlink-app': {
        // entry for the page
        entry: 'src/cashlink.ts',
        // the source template
        template: 'public/cashlink.html',
        // insert browser warning html template
        browserWarningTemplate,
        browserWarningIntegrityHash,
        domain,
        // output as dist/cashlink/index.html
        filename: 'cashlink/index.html',
        // chunks to include on this page, by default includes
        // extracted common chunks and vendor chunks.
        chunks: ['chunk-vendors', 'chunk-common', 'cashlink-app']
    },
    hubexport: {
        // entry for the page
        entry: 'src/export.ts',
        // the source template
        template: 'public/export.html',
        // output as dist/iframe.html
        filename: 'export.html',
    },
};

if (buildName === 'local' || buildName === 'testnet') {
    pages.demos = {
        // entry for the page
        entry: 'demos/Demo.ts',
        // the source template
        template: 'demos/index.html',
        bitcoinJsIntegrityHash,
        // output as dist/demos.html
        filename: 'demos.html',
        // chunks to include on this page, by default includes
        // extracted common chunks and vendor chunks.
        chunks: ['chunk-vendors', 'chunk-common', 'demos'],
    };
    pages.callback = {
        entry: 'demos/callback.ts',
        template: 'demos/callback.html',
        filename: 'callback.html',
        chunks: [],
    };
}

module.exports = {
    pages,
    integrity: true,
    configureWebpack,
    chainWebpack: config => {
        // Do not put prefetch/preload links into the landing pages
        config.plugins.delete('prefetch-index');
        config.plugins.delete('preload-index');
        config.plugins.delete('prefetch-iframe');
        config.plugins.delete('preload-iframe');
        config.plugins.delete('prefetch-cashlink-app');
        config.plugins.delete('preload-cashlink-app');
        config.plugins.delete('prefetch-demos');
        config.plugins.delete('preload-demos');
        config.plugins.delete('prefetch-callback');
        config.plugins.delete('preload-callback');

        config.module
            .rule('ts')
            .use('ts-loader')
            .loader('ts-loader')
            .tap(options => {
                options.configFile = `tsconfig.${buildName}.json`
                return options
            });

        config.module
            .rule('po')
                .test(/\.pot?$/)
                .use('po-loader')
                .loader('webpack-i18n-tools')
                .end()
            .end();

        config
            .plugin('script-ext-html-webpack-plugin')
            .use(ScriptExtHtmlWebpackPlugin, [{
                defaultAttribute: 'defer',
            }]);
    },

    // Add dependencies here which should be transpiled by babel-loader via @vue/cli-plugin-babel. This is needed as our
    // Webpack version is too old to process some modern js syntax in the listed dependencies.
    // When changing to Webpack 5, some or all can probably be removed.
    transpileDependencies: ['@nimiq/utils', '@nimiq/ledger-api'],

    // For iOS debugging in BrowserStack, BrowserStack's localhost tunnel bs-local.com needs to be used, see
    // https://www.browserstack.com/docs/live/local-testing/ios-troubleshooting-guide. However, on bs-local.com features
    // only available on https like crypto.subtle or service workers do not work unless served as https. The Wallet also
    // needs to served with this option and the Keyguard has to be served over https as well. Safari has problems to
    // open the https page with invalid certificate, but Chrome iOS works and also uses the Safari engine. To be able to
    // use the dev tools with Chrome iOS on BrowserStack, launch BrowserStack with Safari first, then switch to Chrome.
    ...(process.env['browserstack-ios-testing'] ? {
        devServer: {
            https: true,
            disableHostCheck: true,
        },
    } : null),
};
