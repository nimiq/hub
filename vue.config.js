const CopyWebpackPlugin = require('copy-webpack-plugin');
const WriteFileWebpackPlugin = require('write-file-webpack-plugin');

const configureWebpack = {
  plugins: [
    new CopyWebpackPlugin([ {from: 'node_modules/@nimiq/vue-components/dist/img', to: 'img'} ]),
    new WriteFileWebpackPlugin(),
  ],
};

module.exports = { configureWebpack };
