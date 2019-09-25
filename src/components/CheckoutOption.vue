<script lang="ts">
import { Vue, Prop } from 'vue-property-decorator';
import { State as RpcState } from '@nimiq/rpc';
import { AvailableParsedPaymentOptions, ParsedCheckoutRequest } from '../lib/RequestTypes';
import { Static } from '../lib/StaticStore';
import StatusScreen from './StatusScreen.vue';
import CheckoutServerApi from '../lib/CheckoutServerApi';
import { PaymentInfoLine } from '@nimiq/vue-components';

export default class CheckoutOption<
    Parsed extends AvailableParsedPaymentOptions,
> extends Vue {
    protected optionTimeout: number = -1;

    @Prop(Object) protected paymentOptions!: Parsed;
    @Static protected rpcState!: RpcState;
    @Static protected request!: ParsedCheckoutRequest;

    protected showStatusScreen: boolean = false;
    protected state = StatusScreen.State.LOADING;
    protected timeOffsetPromise!: Promise<number>;
    protected timeoutReached: boolean = false;
    protected checkNetworkInterval: number = -1;
    protected selected: boolean = false;
    protected title = '';
    protected status = '';
    protected message = '';

    protected async created() {
        // If history.state does have an entry for this currencies previous selection, select it again
        if (window.history.state.selectedCurrency
            && window.history.state.selectedCurrency === this.paymentOptions.currency) {
            await this.selectCurrency();
        }
    }
    protected mounted() {
        if (!this.paymentOptions.expires) {
            this.timeOffsetPromise = Promise.resolve(0);
            return;
        }

        this.getState();

        this.timeOffsetPromise = this.fetchTime().then((referenceTime) => {
            if (this.$refs.info) {
                (this.$refs.info as PaymentInfoLine).setTime(referenceTime);
            }
            this.setupTimeout(referenceTime);
            return referenceTime - Date.now();
        }).catch((e: Error) => {
            this.$rpc.reject(e);
            return 0;
        });
    }

    protected destroyed() {
        if (this.optionTimeout) clearTimeout(this.optionTimeout);
    }

    protected async fetchTime(): Promise<number> {
        if (!this.request.callbackUrl || !this.request.csrf) {
            throw new Error('Can\'t fetch time without callbackUrl and csrf token');
        }
        return CheckoutServerApi.fetchTime(this.request.callbackUrl, this.request.csrf);
    }

    protected getState() {
        if (!this.request.callbackUrl || !this.request.csrf) {
            throw new Error('Can\'t get state without callbackUrl and csrf token');
        }

        CheckoutServerApi.getState(
            this.request.callbackUrl,
            this.paymentOptions.currency,
            this.request.csrf,
        ).then((fetchedState) => {
            if (fetchedState.payment_accepted === true) {
                window.clearInterval(this.checkNetworkInterval);
                window.clearTimeout(this.optionTimeout);
                return this.showSuccessScreen();
            }
            if (this.timeoutReached) {
                window.clearInterval(this.checkNetworkInterval);
                this.timedOut();
            }
        });
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

        this.paymentOptions.update(fetchedData);

        window.clearTimeout(this.optionTimeout);
        this.setupTimeout(Date.now() - (await this.timeOffsetPromise));

        this.showStatusScreen = false;
        this.$forceUpdate();
    }

    protected setupTimeout(referenceTime: number) {
        this.optionTimeout = window.setTimeout(
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
        this.$rpc.resolve({success: false});
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
                return;
            }
        }
        if (!this.paymentOptions.protocolSpecific.recipient) {
            this.$rpc.reject(new Error('Failed to fetch recipient'));
            return;
        }

        // set the selected currency in history state to enable re-selection
        window.history.replaceState(
            Object.assign({}, window.history.state, {selectedCurrency: this.paymentOptions.currency}),
            '');
        this.$emit('chosen', this.paymentOptions.currency);
    }
}
</script>
