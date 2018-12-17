const CopyWebpackPlugin = require('copy-webpack-plugin');
const WriteFileWebpackPlugin = require('write-file-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ScriptExtHtmlWebpackPlugin = require('script-ext-html-webpack-plugin');

const configureWebpack = {
    plugins: [
        new HtmlWebpackPlugin(),
        new ScriptExtHtmlWebpackPlugin({
            defaultAttribute: 'defer'
        }),
        new CopyWebpackPlugin([{ from: 'node_modules/@nimiq/vue-components/dist/img', to: 'img' }]),
        new WriteFileWebpackPlugin(),
    ]
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
        config.optimization.delete('splitChunks')
    }
}
