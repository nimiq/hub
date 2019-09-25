import { Currency, PaymentType, PaymentOptionsForCurrencyAndType, PaymentState } from './PublicRequestTypes';
import { isMilliseconds } from './Helpers';

export interface GetStateResponse {
    time: number;
    payment_accepted: boolean;
    payment_state: PaymentState;
}

export default class CheckoutServerApi {
    public static async fetchTime(endPoint: string, csrfToken: string): Promise<number> {
        let fetchPromise: Promise<GetStateResponse>;
        if (CheckoutServerApi._getStatePromises.size === 0) {
            fetchPromise = CheckoutServerApi.getState(endPoint, Currency.NIM, csrfToken);
        } else {
            fetchPromise = CheckoutServerApi._getStatePromises.entries().next().value[1];
        }
        return fetchPromise.then((value: GetStateResponse) => {
            return isMilliseconds(value.time) ? value.time : value.time * 1000;
        });
    }

    public static async fetchPaymentOption<C extends Currency, T extends PaymentType>(
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

    public static async getState<C extends Currency>(
        endPoint: string,
        currency: C,
        csrfToken: string,
    ): Promise<GetStateResponse> {
        const data = new FormData();
        data.append('currency', currency);
        data.append('command', 'get_state');
        if (CheckoutServerApi._getStatePromises.has(currency)) {
            return CheckoutServerApi._getStatePromises.get(currency)!;
        }
        const fetchedDataPromise = CheckoutServerApi._fetchData(endPoint, data, csrfToken).then(
            (value) => {
                window.setTimeout(
                    () => CheckoutServerApi._getStatePromises.delete(currency),
                    3000,
                );
                value.time = isMilliseconds(value.time) ? value.time : value.time * 1000;
                return value;
            },
            (e) => {
                CheckoutServerApi._getStatePromises.delete(currency);
                return Promise.reject(e);
            },
        );
        CheckoutServerApi._getStatePromises.set(currency, fetchedDataPromise);

        return fetchedDataPromise;
    }

    private static _getStatePromises = new Map<Currency, Promise<GetStateResponse>>();

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
