// Compatibility shim for TS 3.8: generated @nimiq/core WASM types reference Symbol.dispose.
// Remove this when the root project uses TypeScript 5.2+ with esnext.disposable lib support.
interface SymbolConstructor {
    readonly dispose: symbol;
}
