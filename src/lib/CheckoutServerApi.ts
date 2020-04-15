import { Currency, PaymentType, PaymentOptionsForCurrencyAndType, PaymentState } from './PublicRequestTypes';
import { isMilliseconds } from './Helpers';

export interface GetStateResponse {
    time: number;
    payment_accepted: boolean;
    payment_state: PaymentState;
}

export default class CheckoutServerApi {
    public static async fetchTime(endPoint: string, csrfToken: string): Promise<number> {
        const value = await CheckoutServerApi.getState(endPoint, csrfToken);
        return value.time;
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
            const requestData = new URLSearchParams();
            requestData.append('currency', currency);
            requestData.append('command', 'set_currency');
            fetchedData = await CheckoutServerApi._fetchData(endPoint, requestData, csrfToken);

            // Store in state in case this fetch gets repeated (also after reload and history.back)
            history.replaceState({
                ...history.state,
                [currency]: fetchedData,
            }, '');
        }

        if (currency !== fetchedData.currency || type !== fetchedData.type) {
            throw new Error('Unexpected: fetch did not return the correct currency/type combination');
        }

        return fetchedData;
    }

    public static async getState(
        endPoint: string,
        csrfToken: string,
    ): Promise<GetStateResponse> {
        if (CheckoutServerApi._getStatePromise) return CheckoutServerApi._getStatePromise;

        const data = new URLSearchParams();
        data.append('command', 'get_state');

        CheckoutServerApi._getStatePromise = CheckoutServerApi._fetchData(endPoint, data, csrfToken).then(
            (value) => {
                // Clear cached request after 3 seconds
                window.setTimeout(() => CheckoutServerApi._getStatePromise = null, 3000);

                value.time = isMilliseconds(value.time) ? value.time : value.time * 1000;
                return value;
            },
            (e) => {
                CheckoutServerApi._getStatePromise = null;
                return Promise.reject(e);
            },
        );

        return CheckoutServerApi._getStatePromise;
    }

    private static _getStatePromise: Promise<GetStateResponse> | null = null;

    private static async _fetchData(endPoint: string, requestData: URLSearchParams, csrfToken: string): Promise<any> {
        requestData.append('csrf', csrfToken);
        const headers = new Headers();
        const init: RequestInit = {
            method: 'POST',
            headers,
            body: requestData,
            mode: 'cors',
            cache: 'default',
            credentials: 'include',
        };

        let fetchResponse;
        try {
            // First we try to send the request with 'credentials: include', which includes cookies
            // and auth headers in cross-origin requests, but in turn requires the server to set
            // the 'Access-Control-Allow-Credentials: true' header.
            const fetchRequest = new Request(endPoint, init);
            fetchResponse = await fetch(fetchRequest);
        } catch (err) {
            // If the previous request with included credentials fails, we try again with the
            // credentials omitted (default for cross-origin requests). Some implementations might
            // not have the header set, because they don't require cookies or auth headers for
            // authenticating the webhook.
            delete init.credentials;
            const fetchRequest = new Request(endPoint, init);
            fetchResponse = await fetch(fetchRequest);
        }

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
