import { Currency, PaymentMethod, PaymentOptionsForCurrencyAndType } from './PublicRequestTypes';
import { isMilliseconds } from './Constants';

export default class CheckoutServerApi {
    public static async fetchTime(endPoint: string, csrfToken: string): Promise<number> {
        CheckoutServerApi._timePromise = CheckoutServerApi._timePromise || (async () => {
            const requestData = new FormData();
            requestData.append('command', 'get_time');
            const fetchedData = await CheckoutServerApi._fetchData(endPoint, requestData, csrfToken);
            if (!fetchedData.time || typeof fetchedData.time !== 'number') {
                throw new Error('Failed to fetch time.');
            }
            if (isMilliseconds(fetchedData.time)) { // time is already in milliseconds
                return fetchedData.time;
            } else { // time must be converted to milliseconds
                return fetchedData.time * 1000;
            }
        })();
        try {
            return await CheckoutServerApi._timePromise;
        } catch (e) {
            delete CheckoutServerApi._timePromise;
            throw e;
        }
    }

    public static async fetchPaymentOption<C extends Currency, T extends PaymentMethod>(
        endPoint: string,
        currency: C,
        type: T,
        csrfToken: string,
    ): Promise<PaymentOptionsForCurrencyAndType<C, T>> {
        let fetchedData: any;

        if (history.state[currency]) {
            // Retrieve the data from state if already fetched
            fetchedData = history.state[currency];
        } else {
            const requestData = new FormData();
            requestData.append('currency', currency);
            requestData.append('command', 'set_currency');
            fetchedData = await CheckoutServerApi._fetchData(endPoint, requestData, csrfToken);

            // Store in state in case this fetch gets repeated (also after reload and history.back)
            history.replaceState(Object.assign({}, history.state, {
                [currency]: fetchedData,
            }), '');
        }

        if (currency !== fetchedData.currency
            || type !== fetchedData.type) {
            throw new Error('Unexpected: fetch did not return the correct currency/type combination');
        }
        return fetchedData;
    }

    public static async checkNetwork<C extends Currency>(
        endPoint: string,
        currency: C,
        csrfToken: string,
    ): Promise<{ transaction_found: boolean }> {
        const data = new FormData();
        data.append('currency', currency);
        data.append('command', 'check_network');
        return CheckoutServerApi._fetchData(endPoint, data, csrfToken);
    }

    private static _timePromise?: Promise<number>;

    private static async _fetchData(endPoint: string, requestData: FormData, csrfToken: string): Promise<any> {
        requestData.append('csrf', csrfToken);
        const headers = new Headers();
        const init: RequestInit = {
            method: 'POST',
            headers,
            body:  requestData,
            mode: 'cors',
            cache: 'default',
            credentials: 'omit',
        };

        const fetchRequest = new Request(endPoint, init);

        const fetchResponse = await fetch(fetchRequest);
        if (!fetchResponse.ok) {
            throw new Error(`${fetchResponse.status} - ${fetchResponse.statusText}`);
        }

        const fetchedData = await fetchResponse.json();
        if (fetchedData.error) {
            throw new Error(fetchedData.error);
        }

        return fetchedData;
    }
}
