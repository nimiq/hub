<script lang="ts">
import { Vue, Prop } from 'vue-property-decorator';
import { State as RpcState } from '@nimiq/rpc';
import { AvailableParsedPaymentOptions, ParsedCheckoutRequest } from '../lib/RequestTypes';
import { Static } from '../lib/StaticStore';
import StatusScreen from './StatusScreen.vue';
import CheckoutServerApi, { GetStateResponse } from '../lib/CheckoutServerApi';
import { PaymentInfoLine } from '@nimiq/vue-components';
import { ERROR_REQUEST_TIMED_OUT, HISTORY_KEY_SELECTED_CURRENCY } from '../lib/Constants';

export default class CheckoutOption<
    Parsed extends AvailableParsedPaymentOptions,
> extends Vue {
    protected optionTimeout: number = -1;

    @Prop(Object) protected paymentOptions!: Parsed;
    @Static protected rpcState!: RpcState;
    @Static protected request!: ParsedCheckoutRequest;

    protected showStatusScreen: boolean = false;
    protected state = StatusScreen.State.LOADING;
    protected lastPaymentState?: GetStateResponse;
    protected timeOffsetPromise: Promise<number> = Promise.resolve(0);
    protected timeoutReached: boolean = false;
    protected checkNetworkInterval: number = -1;
    protected selected: boolean = false;
    protected title = '';
    protected status = '';
    protected message = '';

    protected async created() {
        // First fetch current state to check whether user already paid and synchronize the time. We can only do this if
        // a callbackUrl was provided. Note that for NIM no merchant server callbackUrl is strictly required as for NIM
        // we can detect payments ourselves (see RequestParser).
        if (this.request.callbackUrl) {
            const statePromise = this.getState();
            this.timeOffsetPromise = statePromise.then((state) => state.time - Date.now());
            try {
                this.lastPaymentState = await statePromise;
            } catch (e) {
                this.$rpc.reject(e);
                return false;
            }
        }

        // If history.state does have an entry for this currencies previous selection, select it again
        if (window.history.state
            && window.history.state[HISTORY_KEY_SELECTED_CURRENCY] === this.paymentOptions.currency
            && !await this.selectCurrency()) {
            return false;
        }

        if (this.paymentOptions.expires) {
            this.setupTimeout();
        }
        return true;
    }

    protected async mounted() {
        if (this.request.callbackUrl && this.$refs.info) {
            (this.$refs.info as PaymentInfoLine).setTime((await this.timeOffsetPromise) + Date.now());
        }
    }

    protected destroyed() {
        if (this.optionTimeout) clearTimeout(this.optionTimeout);
    }

    protected async getState() {
        if (!this.request.callbackUrl || !this.request.csrf) {
            throw new Error('Can\'t get state without callbackUrl and csrf token');
        }

        const fetchedState = await CheckoutServerApi.getState(
            this.request.callbackUrl,
            this.paymentOptions.currency,
            this.request.csrf,
        );
        if (fetchedState.payment_accepted) {
            window.clearInterval(this.checkNetworkInterval);
            window.clearTimeout(this.optionTimeout);
            this.showSuccessScreen();
            return fetchedState;
        }
        if (this.timeoutReached) {
            window.clearInterval(this.checkNetworkInterval);
            this.timedOut();
        }
        return fetchedState;
    }

    protected async fetchPaymentOption(): Promise<void> {
        let fetchedData: any;

        this.title = 'Collecting payment details';
        this.status = '';
        this.showStatusScreen = true;

        if (!this.request.callbackUrl || !this.request.csrf) {
            throw new Error('Can\'t fetch payment details without callbackUrl and csrf token');
        }
        fetchedData = await CheckoutServerApi.fetchPaymentOption(this.request.callbackUrl, this.paymentOptions.currency,
            this.paymentOptions.type, this.request.csrf);

        // @ts-ignore: Call signatures for generic union types are not currently supported, see
        // https://github.com/microsoft/TypeScript/issues/30613 and
        // https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-3.html#caveats
        this.paymentOptions.update(fetchedData);

        // update timeout in case that expiry changed
        if (fetchedData.expires) {
            this.setupTimeout();
        }

        this.showStatusScreen = false;
        this.$forceUpdate();
    }

    protected async setupTimeout() {
        window.clearTimeout(this.optionTimeout);
        const referenceTime = Date.now() + (await this.timeOffsetPromise); // as a side effect ensures lastPaymentState
        if (!this.paymentOptions.expires || this.lastPaymentState && this.lastPaymentState.payment_accepted) return;
        this.optionTimeout = window.setTimeout(
            // if the network check is active, only set a flag to be checked after the network check to avoid that the
            // offer gets displayed as expired when the network check would detect a successful payment.
            () => this.checkNetworkInterval !== -1 ? this.timeoutReached = true : this.timedOut(),
            this.paymentOptions.expires - referenceTime,
        );
    }

    protected timedOut() {
        this.timeoutReached = true;
        this.title = 'The offer expired.';
        this.message = 'Please go back to the shop and restart the process.';
        this.showStatusScreen = true;
        this.state = StatusScreen.State.WARNING;
        this.$emit('expired', this.paymentOptions.currency);
    }

    protected backToShop() {
        this.$rpc.reject(new Error(ERROR_REQUEST_TIMED_OUT));
    }

    protected showSuccessScreen() {
        return;
    }

    protected async selectCurrency() {
        this.selected = true;
        if (this.request.callbackUrl) {
            try {
                await this.fetchPaymentOption();
            } catch (e) {
                this.$rpc.reject(e);
                return false;
            }
        }
        if (!this.paymentOptions.protocolSpecific.recipient) {
            this.$rpc.reject(new Error('Failed to fetch recipient'));
            return false;
        }

        // set the selected currency in history state to enable re-selection
        window.history.replaceState(
            Object.assign({}, window.history.state, {[HISTORY_KEY_SELECTED_CURRENCY]: this.paymentOptions.currency}),
            '');
        this.$emit('chosen', this.paymentOptions.currency);
        return true;
    }
}
</script>
