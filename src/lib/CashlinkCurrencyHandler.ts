import { CashlinkCurrency } from '../../client/PublicRequestTypes';
import CashlinkInteractive from './CashlinkInteractive';
import { CashlinkCurrencyHandlerNimiq } from './CashlinkCurrencyHandlerNimiq';
import { loadBitcoinJS } from './bitcoin/BitcoinJSLoader';

// Lazy load USDT handler to avoid BitcoinJS dependency at module load time
let CashlinkCurrencyHandlerStablecoin: any;

export type CashlinkCurrencyHandlerForCurrency<C extends CashlinkCurrency> = {
    [CashlinkCurrency.NIM]: CashlinkCurrencyHandlerNimiq,
    [CashlinkCurrency.USDT]: any,
}[C];

export async function createCurrencyHandlerForCashlink<C extends CashlinkCurrency>(cashlink: CashlinkInteractive<C>)
    : Promise<CashlinkCurrencyHandlerForCurrency<C>> {
    const currency: CashlinkCurrency = cashlink.currency;
    switch (currency) {
        case CashlinkCurrency.NIM:
            return new CashlinkCurrencyHandlerNimiq(cashlink as CashlinkInteractive<CashlinkCurrency.NIM>) as any;
        case CashlinkCurrency.USDT:
            // Lazy load to avoid BitcoinJS dependency
            if (!CashlinkCurrencyHandlerStablecoin) {
                // Ensure BitcoinJS is loaded BEFORE importing the handler (which imports eth-sig-util)
                await loadBitcoinJS();
                CashlinkCurrencyHandlerStablecoin = (await import('./CashlinkCurrencyHandlerStablecoin'))
                    .CashlinkCurrencyHandlerStablecoin;
            }
            return new CashlinkCurrencyHandlerStablecoin(cashlink as CashlinkInteractive<CashlinkCurrency.USDT>) as any;
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
    getCashlinkFundingDetails(...args: any[]): Promise<unknown>; // return type and params are currency-specific
    claimCashlink(recipient: string): Promise<CashlinkTransaction>;
}
