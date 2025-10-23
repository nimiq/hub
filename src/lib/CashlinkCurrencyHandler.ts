import { CashlinkCurrency } from '../../client/PublicRequestTypes';
import CashlinkInteractive from './CashlinkInteractive';
import { CashlinkCurrencyHandlerNimiq } from './CashlinkCurrencyHandlerNimiq';
import { CashlinkCurrencyHandlerStablecoin } from './CashlinkCurrencyHandlerStablecoin';

export type CashlinkCurrencyHandlerForCurrency<C extends CashlinkCurrency> = {
    [CashlinkCurrency.NIM]: CashlinkCurrencyHandlerNimiq,
    [CashlinkCurrency.USDT]: CashlinkCurrencyHandlerStablecoin,
}[C];

export function createCurrencyHandlerForCashlink<C extends CashlinkCurrency>(cashlink: CashlinkInteractive<C>)
    : CashlinkCurrencyHandlerForCurrency<C> {
    const currency: CashlinkCurrency = cashlink.currency;
    switch (currency) {
        case CashlinkCurrency.NIM:
            return new CashlinkCurrencyHandlerNimiq(
                cashlink as CashlinkInteractive<CashlinkCurrency.NIM>,
            ) as CashlinkCurrencyHandlerForCurrency<C>;
        case CashlinkCurrency.USDT:
            return new CashlinkCurrencyHandlerStablecoin(
                cashlink as CashlinkInteractive<CashlinkCurrency.USDT>,
            ) as CashlinkCurrencyHandlerForCurrency<C>;
        default:
            const _exhaustiveCheck: never = currency; // Check to notice unsupported currency at compilation time.
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
    readonly cashlink: CashlinkInteractive<C>;

    awaitConsensus(): Promise<void>;
    getBlockchainHeight(): Promise<number>;
    getBalance(): Promise<number>;
    getFees(): Promise<number>;
    getConfirmedTransactions(): Promise<CashlinkTransaction[]>;
    getPendingTransactions(): Promise<CashlinkTransaction[]>;
    registerTransactionListener(onTransactionAddedOrUpdated: (transaction: CashlinkTransaction) => void)
        : Promise</* unregister */ () => void>;
    getCashlinkFundingDetails(): Promise<unknown>; // return type is specific to the currency
    claimCashlink(recipient: string): Promise<CashlinkTransaction>;
}
