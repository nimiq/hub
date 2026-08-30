// The jsdom test environment does not provide TextEncoder / TextDecoder, which @nimiq/core's nodejs WASM build
// requires as globals. Provide them from node's util module.
// Note that node's TextEncoder creates Uint8Arrays in node's realm, which are not instanceof the Uint8Array of the
// test context's realm, which would make instanceof checks in the tested code behave differently than in a browser.
// They are therefore re-created in the test context's realm.
const { TextEncoder: NodeTextEncoder, TextDecoder: NodeTextDecoder } = require('util');

if (typeof globalThis.TextEncoder === 'undefined') {
    globalThis.TextEncoder = class TextEncoder extends NodeTextEncoder {
        encode(input) {
            return Uint8Array.from(super.encode(input));
        }
    };
}
if (typeof globalThis.TextDecoder === 'undefined') {
    // Decoding returns a string, i.e. no realm specific instances involved.
    globalThis.TextDecoder = NodeTextDecoder;
}
