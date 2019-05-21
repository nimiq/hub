const Nimiq = require('@nimiq/core'); // tslint:disable-line:no-var-requires variable-name

export const setup = () => {
    // @ts-ignore
    global.Nimiq = Nimiq;

    // Mock WasmHelper as node clients don't provide the WasmHelper
    Nimiq.WasmHelper = {
        doImport: () => {}, // tslint:disable-line:no-empty
    };
};
