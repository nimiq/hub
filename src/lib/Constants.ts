/**
 * Sorted by context and alphabetically
 */

// Accounts
export const KEYGUARD_SLIP0010_BASE_PATH = `m/44'/242'/0'`;
export const DEFAULT_KEY_PATH = `${KEYGUARD_SLIP0010_BASE_PATH}/0'`;
export const MAX_ALLOWED_GAP = 20;

// Transactions
export const TX_MIN_VALIDITY_DURATION = 10;
export const TX_VALIDITY_WINDOW = 120;

// Labels
export const LABEL_MAX_LENGTH = 63; // in bytes
export const DEFAULT_LABEL_LEGACY_WALLET = 'Legacy Wallet';
export const DEFAULT_LABEL_KEYGUARD_WALLET = 'Keyguard Wallet';
export const DEFAULT_LABEL_LEDGER_WALLET = 'Ledger Wallet';
export const DEFAULT_LABEL_KEYGUARD_ACCOUNT = 'Standard Account';
export const DEFAULT_LABEL_LEDGER_ACCOUNT = 'Ledger Account';

// Compatibility
export const LEGACY_GROUPING_WALLET_ID = 'LEGACY';
export const LEGACY_GROUPING_WALLET_LABEL = 'Single Accounts';
