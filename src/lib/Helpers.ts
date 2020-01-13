import Config from 'config';
import {
    NETWORK_TEST,
    NETWORK_DEV,
    NETWORK_MAIN,
    ERROR_INVALID_NETWORK,
} from '../lib/Constants';

export function setHistoryStorage(key: string, data: any) {
    // Note that data can be anything that can be structurally cloned:
    // https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm
    history.replaceState({
        ...history.state,
        [key]: data,
    }, '');
}

export function getHistoryStorage(key: string): any | undefined {
    return history.state ? history.state[key] : undefined;
}

export const loadNimiq = async () => {
    await Nimiq.WasmHelper.doImport();
    let genesisConfigInitialized = true;
    try {
        Nimiq.GenesisConfig.NETWORK_ID; // tslint:disable-line:no-unused-expression
    } catch (e) {
        genesisConfigInitialized = false;
    }
    if (!genesisConfigInitialized) {
        switch (Config.network) {
            case NETWORK_TEST:
                Nimiq.GenesisConfig.test();
                break;
            case NETWORK_MAIN:
                Nimiq.GenesisConfig.main();
                break;
            case NETWORK_DEV:
                Nimiq.GenesisConfig.dev();
                break;
            default:
                throw new Error(ERROR_INVALID_NETWORK);
        }
    }
};
