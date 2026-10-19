// Record of the multi-claimable Cashlinks which were most recently claimed in this browser, see CashlinkInteractive.
// It is a module of its own, such that TestnetUtils can clear it without bundling CashlinkInteractive and the currency
// handlers into every page.

const LAST_CLAIMED_MULTI_CASHLINKS_STORAGE_KEY = 'cashlink-last-claimed-multi-cashlinks';

export function clearLastClaimedMultiCashlinks() {
    window.localStorage.removeItem(LAST_CLAIMED_MULTI_CASHLINKS_STORAGE_KEY);
}

export function getLastClaimedMultiCashlinks(): /* cashlink addresses */ string[] {
    try {
        const storedLastClaimedMultiCashlinks = localStorage[LAST_CLAIMED_MULTI_CASHLINKS_STORAGE_KEY];
        if (!storedLastClaimedMultiCashlinks) return [];
        return JSON.parse(storedLastClaimedMultiCashlinks);
    } catch (e) {
        return [];
    }
}

export function setLastClaimedMultiCashlink(address: string) {
    // restrict to last 5 entries to save storage space
    storeLastClaimedMultiCashlinks([
        address,
        ...getLastClaimedMultiCashlinks(),
    ].slice(0, 5));
}

export function removeLastClaimedMultiCashlink(address: string) {
    const remainingLastClaimedMultiCashlinks = getLastClaimedMultiCashlinks()
        .filter((claimedAddress) => claimedAddress !== address);
    storeLastClaimedMultiCashlinks(remainingLastClaimedMultiCashlinks);
}

function storeLastClaimedMultiCashlinks(addresses: string[]) {
    try {
        window.localStorage[LAST_CLAIMED_MULTI_CASHLINKS_STORAGE_KEY] = JSON.stringify(addresses);
    } catch (e) {
        // The record can't be stored, for example because localStorage is blocked or full. Claiming works without it,
        // but a repeat claim can then only be detected via the addresses the user is logged in with.
    }
}
