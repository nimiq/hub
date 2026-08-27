// jsdom does not provide TextEncoder/TextDecoder, which the wasm-bindgen glue of @nimiq/core
// requires at module load time.
const { TextEncoder, TextDecoder } = require('util');

if (typeof global.TextEncoder === 'undefined') global.TextEncoder = TextEncoder;
if (typeof global.TextDecoder === 'undefined') global.TextDecoder = TextDecoder;
