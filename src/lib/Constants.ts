/**
 * Sorted by context and alphabetically
 */

import { Provider as FiatApiProvider } from '@nimiq/utils';

export { AccountType, WalletType } from '../../client/PublicRequestTypes';

// Addresses
export const DEFAULT_KEY_PATH = `m/44'/242'/0'/0'`;

// Transactions
export const TX_MIN_VALIDITY_DURATION = 10;
export const TX_VALIDITY_WINDOW = 120;
export const CASHLINK_FUNDING_DATA = new Uint8Array([0, 130, 128, 146, 135]);

// Labels
export const LABEL_MAX_LENGTH = 63; // in bytes

// Accounts
export const ACCOUNT_BIP32_BASE_PATH_KEYGUARD = `m/44'/242'/0'/`;
export const ACCOUNT_MAX_ALLOWED_ADDRESS_GAP = 20;

// Compatibility
export const LEGACY_GROUPING_ACCOUNT_ID = 'LEGACY';

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
export const ERROR_REQUEST_TIMED_OUT = 'REQUEST_TIMED_OUT';

// Input
export const MOBILE_MAX_WIDTH = 600; // px

// History state
export const HISTORY_KEY_SELECTED_CURRENCY = 'selected-currency';

// Fiat Api
export const FIAT_API_PROVIDER = FiatApiProvider.CoinGecko;

export const StakingTransactionType = {
    UNSTAKE: 1,

    CREATE_STAKER: 5,
    STAKE: 6,
    UPDATE_STAKER: 7,
};

export const StakingSignallingTypes = [
    StakingTransactionType.UPDATE_STAKER,
];
