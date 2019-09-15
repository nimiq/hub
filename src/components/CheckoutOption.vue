<script lang="ts">
import { Component, Vue, Prop } from 'vue-property-decorator';
import { State, Mutation, Getter } from 'vuex-class';
import { State as RpcState } from '@nimiq/rpc';
import bigInt from 'big-integer';
import { isMilliseconds } from '../lib/Constants';
import { AvailablePaymentOptions, Currency, PaymentMethod, PaymentOptions } from '../lib/PublicRequestTypes';
import {
    AvailableParsedPaymentOptions,
    Omit,
    ParsedCheckoutRequest,
    ParsedPaymentOptions,
    ExtendedPaymentOptions,
} from '../lib/RequestTypes';
import staticStore, { Static } from '../lib/StaticStore';

export default class CheckoutOption<
    Parsed extends AvailableParsedPaymentOptions,
> extends Vue {
    private static timePromise: Promise<number | null> | null = null;

    @Prop(Object) protected paymentOptions!: Parsed;
    @Static protected rpcState!: RpcState;
    @Static protected request!: ParsedCheckoutRequest;

    protected loading: boolean = false;
    protected title = '';
    protected status = '';

    protected fetchTime(): Promise<number | null> {
        if (!CheckoutOption.timePromise) {
            if (this.request.callbackUrl) {
                const data = new FormData();
                data.append('command', 'get_time');
                CheckoutOption.timePromise = this.fetchData(data).then((fetchedData: any) => {
                    if (!fetchedData.time || typeof fetchedData.time !== 'number') {
                        this.$rpc.reject(new Error('get_time callback did not return a number.'));
                    }
                    if (isMilliseconds(fetchedData.time)) { // time is already in milliseconds
                        return parseInt(fetchedData.time, 10);
                    } else { // time must be converted to milliseconds
                        return parseInt(fetchedData.time, 10) * 1000;
                    }
                });
            } else {
                CheckoutOption.timePromise = new Promise(() => null);
            }
        }
        return CheckoutOption.timePromise;
    }

    protected async fetchPaymentOption(): Promise<void> {
        let fetchedData: any;

        if (history.state[this.paymentOptions.currency.toString()]) {
            // Retrieve the data from state if already fetched
            fetchedData = history.state[this.paymentOptions.currency.toString()];
        } else {
            this.title = 'Collecting payment details';
            this.status = '';
            this.loading = true;

            const data = new FormData();
            data.append('currency', this.paymentOptions.currency);
            data.append('command', 'set_currency');
            fetchedData = await this.fetchData(data);

            // Store in state in case this fetch gets repeated (also after reload and history.back)
            history.replaceState(Object.assign({}, history.state, {
                [this.paymentOptions.currency]: fetchedData,
            }), '');
        }

        if (this.paymentOptions.currency !== fetchedData.currency
            || this.paymentOptions.type !== fetchedData.type) {
            this.$rpc.reject(new Error('Unexpected: fetch did not return the correct currency/type combination'));
        }

        this.paymentOptions.update(fetchedData);

        this.loading = false;
        this.$forceUpdate();
    }

    protected async fetchData(data: FormData): Promise<any> {
        data.append('csrf', this.request.csrf!);
        const headers = new Headers();
        const init: RequestInit = {
            method: 'POST',
            headers,
            body:  data,
            mode: 'cors',
            cache: 'default',
            credentials: 'omit',
        };

        const fetchRequest = new Request(this.request.callbackUrl!, init);

        const fetchedData = await (fetch(fetchRequest).then(async (response) => {
            try {
                return await response.json();
            } catch (error) {
                this.$rpc.reject(error);
            }
        }, (error) => {
            this.$rpc.reject(error);
        }));

        if (fetchedData.error) {
            this.$rpc.reject(new Error(fetchedData.error));
        }

        return fetchedData;
    }
}
</script>
