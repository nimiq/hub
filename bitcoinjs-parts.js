const {
    bip32,
    networks,
    payments,
    address,

    // Required by @nimiq/electrum-client
    Transaction,
    script,
    Block,
} = require('bitcoinjs-lib'); // eslint-disable-line import/no-extraneous-dependencies

// Required by @nimiq/electrum-client
const { Buffer } = require('buffer');

module.exports = {
    bip32,
    networks,
    payments,
    address,

    // Required by @nimiq/electrum-client
    Transaction,
    script,
    Block,
    Buffer,
};
