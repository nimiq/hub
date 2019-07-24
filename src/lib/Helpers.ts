import Config from 'config';
import {
    NETWORK_TEST,
    NETWORK_DEV,
    NETWORK_MAIN,
    ERROR_INVALID_NETWORK,
} from '../lib/Constants';

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
