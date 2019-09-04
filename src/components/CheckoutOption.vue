<script lang="ts">
import { Component, Vue, Prop } from 'vue-property-decorator';
import { State, Mutation, Getter } from 'vuex-class';
import { State as RpcState } from '@nimiq/rpc';
import bigInt from 'big-integer';
import { AvailablePaymentOptions, Currency, PaymentType, PaymentOptions } from '../lib/PublicRequestTypes';
import {
    AvailableParsedPaymentOptions,
    ParsedCheckoutRequest,
} from '../lib/RequestTypes';
import staticStore, { Static } from '../lib/StaticStore';

export default class CheckoutOption<
    Parsed extends AvailableParsedPaymentOptions,
> extends Vue {
    @Prop(Object) protected paymentOptions!: Parsed;
    @Static protected rpcState!: RpcState;
    @Static protected request!: ParsedCheckoutRequest;

    protected loading: boolean = false;
    protected title = '';
    protected status = '';

    protected async fetchData(): Promise<void> {
        let fetchedData: any;

        if (history.state[this.paymentOptions.currency.toString()]) {
            // Retrieve the data from state if already fetched
            fetchedData = history.state[this.paymentOptions.currency.toString()];
        } else {
            this.title = 'Collecting payment details';
            this.status = '';
            this.loading = true;

            const headers = new Headers();
            const init: RequestInit = {
                method: 'GET', // POST
                headers,
                // body: {}, // put option as FormData here.
                mode: 'cors',
                cache: 'default',
                credentials: 'omit',
            };
            const callbackUrl = (new URL(this.request.callbackUrl!));
            callbackUrl.searchParams.append('currency', this.paymentOptions.currency);
            const fetchRequest = new Request(`${callbackUrl}`, init);

            fetchedData = await (fetch(fetchRequest).then((data) => data.json()));
            // todo error handling

            // Store in state in case this fetch gets repeated (also after reload and history.back)
            history.replaceState(Object.assign({}, history.state, {
                [this.paymentOptions.currency]: fetchedData,
            }), '');
        }

        if (this.paymentOptions.currency !== fetchedData.currency
            || this.paymentOptions.type !== fetchedData.type) {
            throw new Error('Unexpected: fetch did not return the correct currency/type combination');
        }

        // @ts-ignore: Call signatures for generic union types are not currently supported, see
        // https://github.com/microsoft/TypeScript/issues/30613 and
        // https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-3.html#caveats
        this.paymentOptions.update(fetchedData);

        this.loading = false;
        this.$forceUpdate();
    }
}
</script>
