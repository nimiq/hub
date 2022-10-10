const CopyWebpackPlugin = require('copy-webpack-plugin');
const SriPlugin = require('webpack-subresource-integrity');
const WriteFileWebpackPlugin = require('write-file-webpack-plugin');
const ScriptExtHtmlWebpackPlugin = require('script-ext-html-webpack-plugin');
const path = require('path');
const fs = require('fs');
const createHash = require('crypto').createHash;
// const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const PoLoaderOptimizer = require('webpack-i18n-tools')();
const coreVersion = require('@nimiq/core-web/package.json').version;

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
        ? 'https://hub.nimiq-testnet.com'
        : 'http://localhost:8080';

const cdnDomain = buildName === 'mainnet'
    ? 'https://cdn.nimiq.com'
    : 'https://cdn.nimiq-testnet.com';

const browserWarningTemplate = fs.readFileSync(
    path.join(__dirname, 'node_modules/@nimiq/browser-warning/dist/browser-warning.html.template'));

const browserWarningIntegrityHash = `sha256-${createHash('sha256')
    .update(fs.readFileSync(path.join(__dirname, 'node_modules/@nimiq/browser-warning/dist/browser-warning.js')))
    .digest('base64')}`;
const coreIntegrityHash = `sha256-${createHash('sha256')
    .update(fs.readFileSync(path.join(__dirname, 'node_modules/@nimiq/core-web/web-offline.js')))
    .digest('base64')}`;
const bitcoinJsIntegrityHash = `sha256-${createHash('sha256')
    .update(fs.readFileSync(path.join(__dirname, 'public/bitcoin/BitcoinJS.min.js')))
    .digest('base64')}`;

// Accesible within client code via process.env.VUE_APP_BITCOIN_JS_INTEGRITY_HASH,
// see https://cli.vuejs.org/guide/mode-and-env.html#using-env-variables-in-client-side-code
process.env.VUE_APP_BITCOIN_JS_INTEGRITY_HASH = bitcoinJsIntegrityHash;

console.log('Building for:', buildName);

const configureWebpack = {
    plugins: [
        new SriPlugin({
            hashFuncNames: ['sha256'],
            enabled: process.env.NODE_ENV === 'production',
        }),
        new CopyWebpackPlugin([
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
        ]),
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
    node: false,
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
        'bitcoinjs-lib': 'BitcoinJS',
        'buffer': 'BitcoinJS',
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
        cdnDomain,
        coreVersion,
        coreIntegrityHash,
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
        cdnDomain,
        coreVersion,
        coreIntegrityHash,
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
        cdnDomain,
        coreVersion,
        coreIntegrityHash,
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
        cdnDomain,
        coreVersion,
        coreIntegrityHash,
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
    }
};
