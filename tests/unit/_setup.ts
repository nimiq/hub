const Nimiq = require('@nimiq/core'); // tslint:disable-line:no-var-requires variable-name

export const setup = () => {
    // @ts-ignore
    global.Nimiq = Nimiq;
};
