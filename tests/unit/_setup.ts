// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/naming-convention
const Nimiq = require('@nimiq/core');

export const setup = () => {
    // @ts-ignore
    global.Nimiq = Nimiq;

    // Mock WasmHelper as node clients don't provide the WasmHelper
    Nimiq.WasmHelper = {
        doImport: () => {}, // eslint-disable-line @typescript-eslint/no-empty-function
    };
};
