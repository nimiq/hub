/**
 * Sorted by context and alphabetically
 */

// Addresses
export const DEFAULT_KEY_PATH = `m/44'/242'/0'/0'`;

// Transactions
export const TX_MIN_VALIDITY_DURATION = 10;
export const TX_VALIDITY_WINDOW = 120;

// Labels
export const LABEL_MAX_LENGTH = 63; // in bytes

// Accounts
export const ACCOUNT_BIP32_BASE_PATH_KEYGUARD = `m/44'/242'/0'/`;
export const ACCOUNT_DEFAULT_LABEL_LEDGER = 'Ledger Account';
export const ACCOUNT_DEFAULT_LABEL_LEGACY = 'Legacy Account';
export const ACCOUNT_TEMPORARY_LABEL_KEYGUARD = '~~TEMP~~';
export const ACCOUNT_MAX_ALLOWED_ADDRESS_GAP = 20;

// Contracts
export const CONTRACT_DEFAULT_LABEL_VESTING = 'Vesting Contract';
export const CONTRACT_DEFAULT_LABEL_HTLC = 'HTLC';

// Compatibility
export const LEGACY_GROUPING_ACCOUNT_ID = 'LEGACY';
export const LEGACY_GROUPING_ACCOUNT_LABEL = 'Single Accounts';

// Networks
type NetworkType = 'test' | 'main' | 'dev';
export const NETWORK_TEST: NetworkType = 'test';
export const NETWORK_MAIN: NetworkType = 'main';
export const NETWORK_DEV: NetworkType = 'dev';

// Errors
export const ERROR_CANCELED = 'CANCELED';
export const ERROR_INVALID_NETWORK = 'Invalid network name';
export const ERROR_TRANSACTION_RECEIPTS = 'Failed to retrieve transaction receipts for';
export const ERROR_COOKIE_SPACE = 'Not enough cookie space';
