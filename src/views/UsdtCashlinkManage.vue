<template>
    <div class="container pad-bottom">
        <SmallPage class="cashlink-manage" v-if="retrievedCashlink" :class="{ 'fixed-height': skipSharing }">
            <transition name="transition-fade">
                <StatusScreen v-if="!isTxSent || skipSharing"
                    :state="state"
                    :title="title"
                    :status="status"
                    :message="message"
                    :mainAction="$t('Reload')"
                    :alternativeAction="$t('Cancel')"
                    @main-action="reload"
                    @alternative-action="cancel"
                    lightBlue
                />
            </transition>

            <PageBody v-if="!skipSharing">
                <transition name="transition-fade">
                    <div v-if="isTxSent" class="nq-green cashlink-status">
                        <CheckmarkSmallIcon/>{{ $t('USDT Cashlink created') }}
                    </div>
                </transition>
                <button class="nq-button-s close" @click="close">{{ $t('Done') }}</button>
                <div class="cashlink-and-url">
                    <Account layout="column" :displayAsCashlink="true" :class="{'sending': !isTxSent, 'show-loader': !isTxSent}"/>
                    <div class="cashlink-value">{{ formatUsdtAmount(retrievedCashlink.value) }} USDT</div>
                    <small>{{ $t('Click to copy:') }}</small>
                    <Copyable :text="link">
                        <div class="cashlink-url">{{link}}</div>
                    </Copyable>
                </div>
            </PageBody>
            <PageFooter v-if="!skipSharing">
                <button class="nq-button-s social-share qr-code" @click="qrOverlayOpen = true">
                    <QrCodeIcon/>
                </button>
                <button v-if="nativeShareAvailable" class="nq-button share-mobile" @click="share">
                    {{ $t('Share') }}
                </button>
                <template v-else>
                    <a class="nq-button-s social-share telegram" target="_blank" :href="telegram">
                        <svg width="29" height="25" viewBox="0 0 29 25" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                            <path d="M28.54.53c-.1-.31-.23-.4-.42-.47C27.7-.11 27 .14 27 .14S1.94 9.5.52 10.54c-.31.22-.42.35-.47.5-.25.74.52 1.06.52 1.06l6.46 2.19h.06L10.1 23s.28.59.61.78l.03.02.03.02.13.02h.02c.25 0 .66-.21 1.31-.9a56.7 56.7 0 013.4-3.22 90.48 90.48 0 015.64 4.27c.51.47.95.54 1.3.53.98-.04 1.25-1.16 1.25-1.16S28.41 4.26 28.56 1.7c0-.25.03-.4.03-.58 0-.24-.02-.48-.05-.6zM8.34 13.76v-.13c3.46-2.27 13.88-9.1 14.56-9.35.13-.04.21 0 .2.09-.32 1.12-11.88 11.8-11.88 11.8l-.06.12-.02-.01-.4 4.4-2.4-6.92z"/>
                        </svg>
                    </a>
                    <a class="nq-button-s social-share" :href="mail">
                        <svg width="28" height="24" viewBox="0 0 28 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                            <g>
                                <path d="M13.9 11.36c.14.14.27.14.4 0l12.84-8.55c.27-.14.4-.4.27-.67A2.73 2.73 0 0024.73 0H2.67A2.73 2.73 0 000 2.14c0 .27.13.53.4.8l13.5 8.42z"/>
                                <path d="M15.38 14.44c-.8.53-1.74.53-2.55 0L1.08 6.95c-.4-.13-.8 0-.94.27-.13.13-.13.27-.13.4v13.1a2.68 2.68 0 002.67 2.68h22.06a2.68 2.68 0 002.68-2.68V7.62c0-.4-.27-.67-.67-.67-.13 0-.27 0-.4.14l-10.96 7.35z"/>
                            </g>
                        </svg>
                    </a>
                    <a class="nq-button-s social-share" target="_blank" :href="whatsapp">
                        <svg width="28" height="28" viewBox="0 0 28 28" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                            <path d="M14 0A14 14 0 000 14c0 2.82.82 5.65 2.45 8L.82 26.7c-.12.24 0 .48.11.6.12.11.35.23.59.11l5.01-1.53a13.91 13.91 0 0019.25-4.47c1.4-2.23 2.1-4.82 2.1-7.41C28 6.24 21.7 0 14 0zm8.4 19.65a4.57 4.57 0 01-4.08 2.47c-1.4-.12-2.8-.6-3.97-1.18a16.76 16.76 0 01-7-6.12c-2.22-2.94-2.33-5.76-.23-8.11a2.9 2.9 0 012.21-.6c.59.12 1.17.48 1.4 1.07l.47 1.06c.35.82.7 1.64.7 1.76.23.35.23.82 0 1.18-.35.58-.7 1.17-1.17 1.64a10.68 10.68 0 002.1 2.47 8.68 8.68 0 003.15 1.89c.35-.47.94-1.18 1.17-1.53a1.18 1.18 0 011.52-.47c.46.11 2.91 1.4 2.91 1.4.35.13.59.36.82.6.47.94.47 1.76 0 2.47z"/>
                        </svg>
                    </a>
                </template>
            </PageFooter>

            <transition name="fade">
                <div v-if="qrOverlayOpen" class="qr-overlay" @click.self="qrOverlayOpen = false">
                    <div class="nq-card">
                        <CloseButton @click="qrOverlayOpen = false"/>
                        <QrCode :data="link" fill="#1F2348" background="#fff" ref="qrCode"/>
                        <button class="nq-button-s export-qr-code" @click="exportQrCode">
                            <DownloadIcon/>
                            {{ $t('Download') }}
                        </button>
                    </div>
                </div>
            </transition>
        </SmallPage>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { Static } from '../lib/StaticStore';
import staticStore from '../lib/StaticStore';
import { Cashlink as PublicCashlink, CashlinkCurrency } from '../../client/PublicRequestTypes';
import { ParsedCreateCashlinkRequest, ParsedManageCashlinkRequest } from '../lib/RequestTypes';
import {
    CloseButton,
    SmallPage,
    PageBody,
    PageFooter,
    Account,
    CheckmarkSmallIcon,
    Copyable,
    QrCode,
    QrCodeIcon,
    DownloadIcon,
} from '@nimiq/vue-components';
import StatusScreen from '../components/StatusScreen.vue';
import CashlinkInteractive from '../lib/CashlinkInteractive';
import { CashlinkStore } from '../lib/CashlinkStore';
import { Clipboard } from '@nimiq/utils';
import { i18n } from '../i18n/i18n-setup';
import { ERROR_CANCELED } from '../lib/Constants';
import { State } from 'vuex-class';
import KeyguardClient from '@nimiq/keyguard-client';

@Component({components: {
    Account,
    CheckmarkSmallIcon,
    CloseButton,
    PageBody,
    PageFooter,
    SmallPage,
    StatusScreen,
    Copyable,
    QrCode,
    QrCodeIcon,
    DownloadIcon,
}})
export default class UsdtCashlinkManage extends Vue {
    private static readonly SHARE_PREFIX: string = i18n.t('Here is your USDT Cashlink!') as string;

    public $refs!: {
        qrCode: QrCode,
    };

    @Static private request!: ParsedManageCashlinkRequest | ParsedCreateCashlinkRequest;
    @Static private keyguardRequest?: any;
    @State private keyguardResult?: KeyguardClient.SignedPolygonTransaction;

    private isTxSent: boolean = false;
    private status: string = i18n.t('Preparing transaction...') as string;
    private state: StatusScreen.State = StatusScreen.State.LOADING;
    private message: string = '';
    private retrievedCashlink: CashlinkInteractive | null = null;
    private copied: boolean = false;
    private qrOverlayOpen = false;

    // @ts-ignore Property 'share' does not exist on type 'Navigator'
    private readonly nativeShareAvailable: boolean = (!!window.navigator && !!window.navigator.share);

    private get skipSharing(): boolean {
        return 'skipSharing' in this.request && !!this.request.skipSharing;
    }

    private async mounted() {
        const Cashlink = (await import('../lib/Cashlink')).default;
        let storedBaseCashlink: typeof Cashlink.prototype | null = null;
        const isManagementRequest = !staticStore.cashlink;

        if ('cashlinkAddress' in this.request && !!this.request.cashlinkAddress) {
            // Management request (viewing existing cashlink)
            storedBaseCashlink = await CashlinkStore.Instance.get(this.request.cashlinkAddress.toUserFriendlyAddress());
            if (!storedBaseCashlink || storedBaseCashlink.currency !== CashlinkCurrency.USDT) {
                const addr = this.request.cashlinkAddress;
                this.$rpc.reject(new Error(`Could not find USDT Cashlink for address ${addr}.`));
                return;
            }
            this.isTxSent = true;
        } else if (staticStore.cashlink && staticStore.cashlink.currency === CashlinkCurrency.USDT) {
            // Creation request (just created cashlink)
            storedBaseCashlink = await CashlinkStore.Instance.get(staticStore.cashlink.address);
            this.isTxSent = !!storedBaseCashlink; // Already sent if it's in the store
        } else {
            this.$rpc.reject(new Error('UsdtCashlinkManage expects a USDT cashlink to display.'));
            return;
        }

        this.retrievedCashlink = storedBaseCashlink
            ? new CashlinkInteractive(storedBaseCashlink)
            : staticStore.cashlink!;

        if (!this.isTxSent) {
            // Need to relay the transaction
            if (!this.keyguardResult || !this.keyguardRequest) {
                this.$rpc.reject(new Error('Unexpected: No valid keyguard result for USDT Cashlink'));
                return;
            }

            this.status = this.$t('Sending transaction...') as string;

            // Store cashlink first
            await CashlinkStore.Instance.put(this.retrievedCashlink);

            try {
                const { sendTransaction } = await import('../lib/polygon/ethers');

                // Send the signed transaction to the network via OpenGSN relay
                await sendTransaction(
                    (await import('config')).default.polygon.usdt_bridged.tokenContract,
                    this.keyguardRequest.request,
                    this.keyguardResult.signature,
                    this.keyguardRequest.relay.url,
                );

                this.isTxSent = true;
                console.log('USDT Cashlink transaction sent successfully');
            } catch (error) {
                console.error('Error relaying transaction:', error);
                this.state = StatusScreen.State.WARNING;
                this.message = (error as Error).message;
                return;
            }
        }

        if (this.skipSharing) {
            this.state = StatusScreen.State.SUCCESS;
            window.setTimeout(() => this.close(), StatusScreen.SUCCESS_REDIRECT_DELAY);
        }
    }

    private get title(): string {
        switch (this.state) {
            case StatusScreen.State.SUCCESS: return this.$t('USDT Cashlink created.') as string;
            case StatusScreen.State.WARNING: return this.$t('Something went wrong') as string;
            default: return this.$t('Creating your USDT Cashlink') as string;
        }
    }

    private get link(): string {
        return `${window.location.origin}/usdt-cashlink/#${this.retrievedCashlink!.render()}`;
    }

    private formatUsdtAmount(cents: number): string {
        return (cents / 1000000).toFixed(2);
    }

    private close() {
        const result: PublicCashlink = {
            currency: this.retrievedCashlink!.currency,
            address: this.retrievedCashlink!.address,
            message: this.retrievedCashlink!.message,
            value: this.retrievedCashlink!.value,
            theme: this.retrievedCashlink!.theme,
        };
        if ('returnLink' in this.request && this.request.returnLink) {
            result.link = this.link;
        }
        this.$rpc.resolve(result);
    }

    private copy() {
        Clipboard.copy(this.link);
        this.copied = true;
        setTimeout(() => this.copied = false, 800);
    }

    private get shareText(): string {
        return encodeURIComponent(`${UsdtCashlinkManage.SHARE_PREFIX} ${this.link}`);
    }

    private share() {
        (navigator as any).share({
            title: 'USDT Cashlink',
            text: UsdtCashlinkManage.SHARE_PREFIX,
            url: this.link,
        }).catch( (error: Error) => console.log('Error sharing', error));
    }

    private get telegram(): string {
        return `https://telegram.me/share/msg?url=${location.host}&text=${this.shareText}`;
    }

    private get mail(): string {
        return `mailto:?subject=${encodeURIComponent('USDT Cashlink')}&body=${this.shareText}`;
    }

    private get whatsapp(): string {
        return `https://api.whatsapp.com/send?text=${this.shareText}`;
    }

    private reload() {
        window.location.reload();
    }

    private cancel() {
        this.$rpc.reject(new Error(ERROR_CANCELED));
    }

    private async exportQrCode() {
        const data = await this.$refs.qrCode.toDataUrl();

        const link = document.createElement('a');
        link.download = 'UsdtCashlink.png';
        link.href = data;

        document.body.appendChild(link);
        link.click();

        document.body.removeChild(link);
    }
}
</script>

<style scoped>
    .cashlink-manage {
        position: relative;
        overflow: hidden;
    }

    .cashlink-manage:not(.fixed-height) {
        height: auto;
        min-height: 70.5rem;
    }

    .status-screen {
        position: absolute;
        transition: opacity .3s var(--nimiq-ease);
    }

    .close {
        position: absolute;
        top: 2rem;
        right: 2rem;
    }

    .cashlink-status {
        position: absolute;
        top: 2rem;
        left: 2rem;
        transition: opacity .4s var(--nimiq-ease);
        font-size: 2rem;
        font-weight: bold;
    }

    .cashlink-status .nq-icon {
        font-size: 1.5rem;
        margin-right: 1.25rem;
    }

    .cashlink-manage .cashlink-and-url {
        height: 100%;
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        flex-grow: 1;
    }

    .cashlink-manage .cashlink-value {
        font-size: 3rem;
        font-weight: bold;
        color: var(--nimiq-green);
        margin: 1rem 0;
    }

    .cashlink-manage .cashlink >>> .identicon {
        width: 18rem;
        height: 18rem;
        padding: 1rem;
        margin-bottom: 1.25rem;
    }

    .cashlink-manage .cashlink >>> .identicon:before {
        border: .5rem solid transparent;
    }

    .cashlink-manage .cashlink.show-loader >>> .identicon:before {
        border: .5rem solid var(--nimiq-green);
        animation: spin 4s linear infinite;
        transition: border 1s var(--nimiq-ease);
    }

    .cashlink-manage .cashlink.show-loader.sending  >>> .identicon:before {
        border-color: var(--nimiq-gray) var(--nimiq-gray) var(--nimiq-gray) var(--nimiq-green);
    }

    @keyframes spin { 100% { -webkit-transform: rotate(360deg); transform:rotate(360deg); } }

    .cashlink-manage .cashlink-and-url .cashlink-url {
        text-align: center;
        font-size: 3rem;
        line-height: 4rem;
        text-transform: none;
        word-break: break-all;
        max-width: unset;
        max-height: unset;
        opacity: .5;
    }

    .cashlink-manage .cashlink-and-url .copyable {
        padding: 0.75rem 1.5rem;
        margin-top: 1rem;
    }

    .cashlink-manage .cashlink-and-url small {
        font-size: 1.625rem;
        opacity: 0.5;
        font-weight: bold;
    }

    .page-body {
        padding-top: 6rem;
        padding-bottom: 0;
        display: flex;
        flex-direction: column;
    }

    .page-footer {
        flex-direction: row;
        justify-content: space-evenly;
    }

    .page-footer .nq-button {
        min-width: unset;
        width: 17rem;
        margin-left: unset;
        margin-right: unset;
    }

    .page-footer .nq-button:hover,
    .page-footer .nq-button:focus {
        transform: none;
    }

    .social-share {
        width: 7.5rem;
        height: 7.5rem;
        border-radius: 50%;
        padding: 2rem;
        margin: 2rem 0 3rem;
    }

    .social-share.telegram {
        padding-left: 1.75rem;
        padding-right: 2.25rem;
    }

    .social-share svg {
        width: 3.5rem;
        height: 3.5rem;
        transition: opacity .4s var(--nimiq-ease);
        opacity: .5;
    }

    .social-share:hover svg,
    .social-share:focus svg {
        opacity: .7;
    }

    .share-mobile {
        background: none;
        box-shadow: none;
        background-color: rgba(31, 184, 109, 0.1); /* Green for USDT */
        color: rgba(31, 184, 109, 0.9);
        transition: background-color 300ms var(--nimiq-ease), color 300ms var(--nimiq-ease);
    }

    .share-mobile:hover,
    .share-mobile:focus {
        background: none;
        background-color: rgba(31, 184, 109, 0.15);
        color: rgba(31, 184, 109, 1);
    }

    .qr-overlay {
        position: absolute;
        top: 0;
        right: 0;
        bottom: 0;
        left: 0;
        background: rgba(31, 35, 72, 0.85);
    }

    .qr-overlay .nq-card {
        position: absolute;
        left: 50%;
        top: 50%;
        padding: 2rem;
        margin-left: -17rem;
        margin-top: -19.5rem;
    }

    .qr-overlay .qr-code {
        width: 30rem;
    }

    .qr-overlay .close-button {
        display: block;
        margin-left: auto;
        margin-bottom: 2rem;
    }

    .qr-overlay .export-qr-code {
        display: block;
        margin: 2rem auto 0.75rem;
    }

    .fade-enter-active, .fade-leave-active {
        transition: opacity .5s var(--nimiq-ease);
    }
    .fade-enter, .fade-leave-to {
        opacity: 0;
        pointer-events: none;
    }

    @media (max-width: 450px) {
        .qr-overlay .nq-card {
            border-radius: 1.25rem;
        }
    }
</style>
