<script lang="ts">
import { Vue, Prop } from 'vue-property-decorator';
import { State as RpcState } from '@nimiq/rpc';
import { AvailableParsedPaymentOptions, ParsedCheckoutRequest } from '../lib/RequestTypes';
import { Static } from '../lib/StaticStore';
import StatusScreen from './StatusScreen.vue';
import CheckoutServerApi from '../lib/CheckoutServerApi';
import { PaymentInfoLine } from '@nimiq/vue-components';
import { ERROR_REQUEST_TIMED_OUT } from '../lib/Constants';

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
    protected title = '';
    protected status = '';
    protected message = '';

    protected mounted() {
        if (!this.paymentOptions.expires) {
            this.timeOffsetPromise = Promise.resolve(0);
            return;
        }
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

        this.showStatusScreen = false;
        this.$forceUpdate();
    }

    protected setupTimeout(referenceTime: number) {
        if (!this.paymentOptions.expires) return;
        this.optionTimeout = window.setTimeout(
            () => this.timeoutReached = true,
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
}
</script>
