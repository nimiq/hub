import { CashlinkCurrency } from '../../client/PublicRequestTypes';
import type Cashlink from './Cashlink';
import { CashlinkCurrencyHandlerNimiq } from './CashlinkCurrencyHandlerNimiq';
import { CashlinkCurrencyHandlerStablecoin } from './CashlinkCurrencyHandlerStablecoin';
import type { WalletInfo } from './WalletInfo';

export type CashlinkCurrencyHandlerForCurrency<C extends CashlinkCurrency> = {
    [CashlinkCurrency.NIM]: CashlinkCurrencyHandlerNimiq,
    [CashlinkCurrency.USDT]: CashlinkCurrencyHandlerStablecoin,
}[C];

// A Cashlink of a single currency, typed as the union of the Cashlink types of all currencies, such that checking its
// currency narrows its type, which is not the case for a Cashlink<CashlinkCurrency>.
export type CashlinkOfSomeCurrency = { [C in CashlinkCurrency]: Cashlink<C> }[CashlinkCurrency];

export function createCurrencyHandlerForCashlink<C extends CashlinkCurrency>(cashlink: Cashlink<C>)
    : CashlinkCurrencyHandlerForCurrency<C>;
export function createCurrencyHandlerForCashlink(cashlink: CashlinkOfSomeCurrency)
    : CashlinkCurrencyHandlerForCurrency<CashlinkCurrency> {
    switch (cashlink.currency) {
        case CashlinkCurrency.NIM:
            return new CashlinkCurrencyHandlerNimiq(cashlink);
        case CashlinkCurrency.USDT:
            return new CashlinkCurrencyHandlerStablecoin(cashlink);
        default:
            const _exhaustiveCheck: never = cashlink; // Check to notice unsupported currency at compilation time.
            return _exhaustiveCheck;
    }
}

// Simplified and generalized transaction definition, which should be applicable to most currencies.
export interface CashlinkTransaction {
    transactionHash: string;
    sender: string;
    recipient: string;
    value: number;
    fee: number;
    state: 'pending'
        | 'confirmed' // included on chain with no further requirement on number of confirmations
        | 'expired';
}

export interface ICashlinkCurrencyHandler<C extends CashlinkCurrency> {
    readonly currency: C;
    readonly cashlink: Cashlink<C>;

    awaitConsensus(): Promise<void>;
    getBlockchainHeight(): Promise<number>;
    getBalance(): Promise<number>;
    getFeeSuggestion(): Promise<number>;
    getConfirmedTransactions(): Promise<CashlinkTransaction[]>;
    getPendingTransactions(): Promise<CashlinkTransaction[]>;
    registerTransactionListener(onTransactionAddedOrUpdated: (transaction: CashlinkTransaction) => void)
        : Promise</* unregister */ () => void>;
    getUserAddresses(wallets: WalletInfo[]): Set<string>;
    getCashlinkFundingDetails(...args: unknown[]): unknown; // parameters and return type are specific to the currency
    claimCashlink(recipient: string, balance: number, claimAmount: number): Promise<CashlinkTransaction>;
}
