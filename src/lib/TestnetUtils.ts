import Config from 'config';
import { NETWORK_DEV, NETWORK_TEST } from './Constants';
import { WalletStore } from './WalletStore';
import { CashlinkStore } from './CashlinkStore';
import Cashlink, { CashlinkEntry } from './Cashlink';

// Same localStorage key and value format as in the Nimiq Wallet.
const TESTNET_VERSION_LOCALSTORAGE_KEY = 'testnet-version';

let clearPromise: Promise<void> | null = null;

/**
 * After a testnet reset via a new genesis block clear outdated data:
 * - cached NIM balances of accounts and contracts
 * - Cashlinks created after the new genesis block's date
 * - the record of recently claimed multi-cashlinks
 *
 * On failure, the version flag remains unset and clearing is retried on the next invocation or page load.
 *
 * Note that this method has no dependency on Nimiq, and can thus run while Nimiq is not loaded yet. The called methods
 * intentionally work on plain database entries.
 */
export function clearOutdatedTestnetData(): Promise<void> {
    if (!clearPromise) {
        clearPromise = _clearOutdatedTestnetData().catch((error) => {
            clearPromise = null; // retry on next invocation
            console.error('Failed to clear outdated testnet data:', error);
        });
    }
    return clearPromise;
}

async function _clearOutdatedTestnetData(): Promise<void> {
    if (Config.network !== NETWORK_TEST && Config.network !== NETWORK_DEV) return;

    const currentTestnetVersion = Config.genesisDate.toISOString();
    const storedTestnetVersion = window.localStorage.getItem(TESTNET_VERSION_LOCALSTORAGE_KEY);
    if (storedTestnetVersion === currentTestnetVersion) return;

    // Clear cached NIM balances; they get re-fetched on demand.
    await WalletStore.Instance.clearBalances();

    // Delete Cashlinks created after the new genesis block date, as their funding happened on the discarded chain only.
    const genesisTimestamp = Config.genesisDate.getTime() / 1000; // Cashlink timestamps are in seconds
    for (const cashlinkEntry of await CashlinkStore.Instance.list()) {
        const timestamp = cashlinkEntry.timestamp;
        if (!timestamp || timestamp <= genesisTimestamp) continue;
        await CashlinkStore.Instance.remove(cashlinkEntry.address);
    }

    // Remove the record of claimed multi-cashlinks, such that the Cashlink state gets re-detected on the new chain.
    Cashlink.clearLastClaimedMultiCashlinks();

    window.localStorage.setItem(TESTNET_VERSION_LOCALSTORAGE_KEY, currentTestnetVersion);
    console.info(`Reset outdated testnet data for version ${storedTestnetVersion}`);
}
