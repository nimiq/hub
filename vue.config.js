const CopyWebpackPlugin = require('copy-webpack-plugin');
const WriteFileWebpackPlugin = require('write-file-webpack-plugin');
const path = require('path');

const buildName = process.env.build
    ? process.env.build
    : process.env.NODE_ENV === 'production'
        ? 'testnet'
        : 'local';

console.log('Building for:', buildName);

const configureWebpack = {
    plugins: [
        new CopyWebpackPlugin([{ from: 'node_modules/@nimiq/vue-components/dist/img', to: 'img' }]),
        new WriteFileWebpackPlugin()
    ],
    // Resolve config for yarn build
    resolve: {
        alias: {
            config: path.join(__dirname, `src/config/config.${buildName}.ts`)
        }
    },
    // Fix sourcemaps (https://www.mistergoodcat.com/post/the-joy-that-is-source-maps-with-vuejs-and-typescript)
    devtool: 'eval-source-map',
    output: {
        devtoolModuleFilenameTemplate: info => {
            var $filename = 'sources://' + info.resourcePath;
            if (info.resourcePath.match(/\.vue$/) && !info.query.match(/type=script/)) {
                $filename = 'webpack-generated:///' + info.resourcePath + '?' + info.hash;
            }
            return $filename;
        },
        devtoolFallbackModuleFilenameTemplate: 'webpack:///[resource-path]?[hash]',
    },
};

module.exports = {
    pages: {
        index: {
            // entry for the page
            entry: 'src/main.ts',
            // the source template
            template: 'public/index.html',
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
        demos: {
            // entry for the page
            entry: 'demos/Demo.ts',
            // the source template
            template: 'demos/index.html',
            // output as dist/index.html
            filename: 'demos.html',
            // chunks to include on this page, by default includes
            // extracted common chunks and vendor chunks.
            chunks: ['chunk-vendors', 'chunk-common', 'demos']
        },
    },
    configureWebpack,
    chainWebpack: config => {
        config.optimization.delete('splitChunks'),
        config.module
            .rule('ts')
            .use('ts-loader')
            .loader('ts-loader')
            .tap(options => {
                options.configFile = `tsconfig.${buildName}.json`
                return options
        })
    }
}
