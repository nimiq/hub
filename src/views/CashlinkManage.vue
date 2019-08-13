<template>
    <div class="container pad-bottom" v-if="retrievedCashlink">
        <SmallPage class="cashlink-receive">
            <transition name="transition-fade">
                <StatusScreen v-if="!isTxSent" state="loading" :title="title" :status="status" lightBlue/>
            </transition>

            <PageBody>
                <transition name="transition-fade">
                    <div v-if="!isManagementRequest && isTxSent" class="nq-green cashlink-status"><CheckmarkSmallIcon/>Cashlink created</div>
                </transition>
                <button class="nq-button-s close" @click="close">Done</button>
                <div class="cashlink-and-url">
                    <Account :displayAsCashlink="true" layout="column" :class="{'sending': !isTxSent, 'show-loader': !isManagementRequest}"/>
                    <Copyable :text="link">
                        <div class="cashlink-url">{{link}}</div>
                    </Copyable>
                </div>
            </PageBody>
            <PageFooter v-if="nativeShareAvailable">
                <button class="nq-button copy" :class="copied ? 'green' : 'light-blue'" @click="copy">
                    <span v-if="copied"><CheckmarkSmallIcon /> Copied</span>
                    <span v-else>Copy</span>
                </button>
                <button class="nq-button share-mobile" @click="share">
                    Share
                </button>
            </PageFooter>
            <PageFooter v-else>
                <button class="nq-button copy" :class="copied ? 'green' : 'light-blue'" @click="copy">
                    <span v-if="copied"><CheckmarkSmallIcon /> Copied</span>
                    <span v-else>Copy</span>
                </button>
                <a class="nq-button-s social-share telegram" :href="telegram" target="_blank">
                    <svg width="29" height="25" viewBox="0 0 29 25" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <path opacity=".6" d="M28.537.528c-.103-.308-.224-.397-.416-.472-.42-.164-1.124.084-1.124.084S1.943 9.496.516 10.534c-.308.225-.416.351-.467.505-.247.74.523 1.062.523 1.062l6.458 2.185s.023.005.056.005l3.024 8.7s.275.585.61.777c.01.01.024.014.033.023l.028.014c.038.019.08.028.131.028.005 0 .01.005.014.005h.005c.252 0 .658-.22 1.311-.903a56.694 56.694 0 0 1 3.392-3.227c2.221 1.595 4.61 3.354 5.642 4.275.518.463.952.538 1.306.524.98-.038 1.251-1.155 1.251-1.155s4.573-19.09 4.722-21.65c.014-.252.038-.411.038-.584.004-.239-.019-.477-.056-.59zM8.332 13.758l.004-.132c3.463-2.268 13.887-9.089 14.568-9.35.122-.038.21.004.187.093-.308 1.123-11.866 11.797-11.866 11.797s-.042.056-.07.122l-.014-.01-.397 4.398-2.412-6.919z"/>
                    </svg>
                </a>
                <a class="nq-button-s social-share" :href="mail">
                    <svg width="28" height="24" viewBox="0 0 28 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <g opacity=".6">
                            <path d="M13.9047 11.3644C14.0384 11.4981 14.1721 11.4981 14.3058 11.3644L27.1408 2.80767C27.4082 2.67397 27.5419 2.40658 27.4082 2.13918C27.1408 0.935891 26.0713 0 24.7343 0H2.67397C1.33699 0 0.267397 0.935891 0 2.13918C0 2.40658 0.133699 2.67397 0.401096 2.94137L13.9047 11.3644Z"/>
                            <path d="M15.3754 14.4395C14.5732 14.9743 13.6373 14.9743 12.8351 14.4395L1.06959 6.95235C0.668494 6.81865 0.267398 6.95235 0.133699 7.21975C0 7.35345 0 7.48715 0 7.62085V20.7233C0 22.194 1.20329 23.3973 2.67398 23.3973H24.7343C26.205 23.3973 27.4082 22.194 27.4082 20.7233V7.62085C27.4082 7.21975 27.1408 6.95235 26.7398 6.95235C26.6061 6.95235 26.4724 6.95235 26.3387 7.08605L15.3754 14.4395Z"/>
                        </g>
                    </svg>
                </a>
                <a class="nq-button-s social-share" :href="whatsapp" target="_blank">
                    <svg width="28" height="28" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <path opacity=".6" d="M14 0C6.3 0 0 6.235 0 14c0 2.823.817 5.647 2.45 8L.817 26.706c-.117.235 0 .47.116.588.117.118.35.235.584.118l5.016-1.53C13.067 30 21.7 28 25.783 21.412c1.4-2.235 2.1-4.824 2.1-7.412C28 6.235 21.7 0 14 0zm8.4 19.647c-.817 1.53-2.333 2.47-4.083 2.47-1.4-.117-2.8-.588-3.967-1.176-2.8-1.294-5.25-3.412-7-6.117-2.217-2.942-2.333-5.765-.233-8.118.583-.47 1.4-.706 2.216-.588.584.117 1.167.47 1.4 1.058l.467 1.06c.35.823.7 1.646.7 1.764.233.353.233.823 0 1.177-.35.588-.7 1.176-1.167 1.646a10.68 10.68 0 0 0 2.1 2.471c.934.824 1.984 1.53 3.15 1.883.35-.471.934-1.177 1.167-1.53a1.175 1.175 0 0 1 1.517-.47c.466.117 2.916 1.411 2.916 1.411.35.118.584.353.817.588.467.942.467 1.765 0 2.471z"/>
                    </svg>
                </a>
            </PageFooter>
        </SmallPage>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Watch } from 'vue-property-decorator';
import staticStore, { Static } from '../lib/StaticStore';
import { ParsedCashlinkRequest, RequestType } from '../lib/RequestTypes';
import { SmallPage, PageBody, PageFooter, Account, CheckmarkSmallIcon, Copyable } from '@nimiq/vue-components';
import StatusScreen from '../components/StatusScreen.vue';
import { NetworkClient } from '@nimiq/network-client';
import { loadNimiq } from '../lib/Helpers';
import Cashlink from '../lib/Cashlink';
import { CashlinkState } from '@/lib/PublicRequestTypes';
import { CashlinkStore } from '../lib/CashlinkStore';
import { State } from 'vuex-class';
import KeyguardClient from '@nimiq/keyguard-client';
import { Cashlink as PublicCashlink } from '../lib/PublicRequestTypes';
import { Clipboard } from '@nimiq/utils';

@Component({components: {
    Account,
    CheckmarkSmallIcon,
    PageBody,
    PageFooter,
    SmallPage,
    StatusScreen,
    Copyable,
}})
export default class CashlinkManage extends Vue {
    @Static private request!: ParsedCashlinkRequest;
    @Static private cashlink!: Cashlink;
    @Static private keyguardRequest!: KeyguardClient.SignTransactionRequest;
    @State private keyguardResult?: KeyguardClient.SignTransactionResult;

    private isTxSent: boolean = false;
    private isManagementRequest = false;
    private status: string = 'Connecting to network...';
    private state: StatusScreen.State = StatusScreen.State.LOADING;
    private retrievedCashlink: Cashlink | null = null;
    private copied = false;
    private nativeShareAvailable: boolean = false;

    private sharePrefix = 'Here is your Nimiq Cashlink!';

    private async mounted() {
        // @ts-ignore Property 'share' does not exist on type 'Navigator'
        this.nativeShareAvailable = (!!window.navigator && !!window.navigator.share);
        this.retrievedCashlink = this.cashlink;
        if (!this.keyguardResult) {
            // If there is no Keyguard result this is not a freshly funded cashlink
            // and must be retrieved from the store.
            if (this.request.cashlinkAddress) {
                const cashlink = await CashlinkStore.Instance.get(this.request.cashlinkAddress.toUserFriendlyAddress());
                if (cashlink) {
                    this.retrievedCashlink = cashlink;
                    this.isTxSent = true;
                    this.isManagementRequest = true;
                }
            }
        }

        if (!this.isTxSent) {
            const network = NetworkClient.Instance;
            await network.init();
            await network.connectPico();

            if (!this.keyguardResult || !this.keyguardRequest) {
                this.$rpc.reject(new Error('Unexpected: No valid Cashlink;'));
                return;
            }
            // if there was a funding transaction the cashlink is in the static store.
            this.retrievedCashlink.networkClient = network;
            network.on(NetworkClient.Events.API_READY,
                () => this.status = 'Contacting seed nodes...');
            network.on(NetworkClient.Events.CONSENSUS_SYNCING,
                () => this.status = 'Syncing consensus...');
            network.on(NetworkClient.Events.CONSENSUS_ESTABLISHED,
                () => this.status = 'Sending transaction...');
            network.on(NetworkClient.Events.TRANSACTION_PENDING,
                () => this.status = 'Awaiting receipt confirmation...');

            const result = await network.relayTransaction({
                sender: new Nimiq.Address(this.keyguardRequest.sender).toUserFriendlyAddress(),
                senderPubKey: this.keyguardResult.publicKey,
                recipient:  new Nimiq.Address(this.keyguardRequest.recipient).toUserFriendlyAddress(),
                value: Nimiq.Policy.lunasToCoins(this.keyguardRequest.value),
                fee: Nimiq.Policy.lunasToCoins(this.keyguardRequest.fee),
                validityStartHeight: this.keyguardRequest.validityStartHeight,
                signature: this.keyguardResult.signature,
                extraData: this.keyguardRequest.data,
            });

            network.on(NetworkClient.Events.TRANSACTION_RELAYED, async (txInfo: any) => {
                await CashlinkStore.Instance.put(this.retrievedCashlink!);
                this.isTxSent = true;
                window.setTimeout(() => this.state = StatusScreen.State.SUCCESS, StatusScreen.SUCCESS_REDIRECT_DELAY);
            });
        }
    }

    private get title(): string {
        return this.state === StatusScreen.State.LOADING ? 'Creating your Cashlink' : 'Cashlink created.';
    }

    private get link(): string {
        return `${window.location.origin}/${RequestType.CASHLINK}/#${this.retrievedCashlink!.render()}`;
    }

    private close() {
        this.$rpc.resolve({
            address: this.retrievedCashlink!.address.toUserFriendlyAddress(),
            message: this.retrievedCashlink!.message,
            status: this.retrievedCashlink!.state,
            sender: this.retrievedCashlink!.originalSender,
        } as PublicCashlink);
    }

    private copy() {
        Clipboard.copy(this.link);

        this.copied = true;
        setTimeout(() => this.copied = false, 800);
    }

    private get shareText(): string {
        return encodeURIComponent(`${this.sharePrefix} ${this.link}`);
    }

    private share() {
        (navigator as any).share({
            title: 'Nimiq Cashlink',
            text: this.sharePrefix,
            url: this.link,
        }).catch( (error: Error) => console.log('Error sharing', error));
    }

    private get telegram(): string {
        return `https://telegram.me/share/msg?url=${location.host}&text=${this.shareText}`;
    }

    private get mail(): string {
        return `mailto:?subject=${encodeURIComponent('Nimiq Cashlink')}&body=${this.shareText}`;
    }

    private get whatsapp(): string {
        return `https://api.whatsapp.com/send?text=${this.shareText}`;
    }
}
</script>

<style scoped>
    .cashlink-receive {
        position: relative;
        height: auto;
    }

    .status-screen {
        position: absolute;
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

    .cashlink-receive .cashlink-and-url {
        height: 100%;
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        flex-grow: 1;
    }

    .cashlink-receive .cashlink >>> .identicon {
        width: 18rem;
        height: 18rem;
        padding: 1rem;
        margin-bottom: 1.25rem;
    }

    .cashlink-receive .cashlink >>> .identicon:before {
        border: .5rem solid transparent;
    }

    .cashlink-receive .cashlink.show-loader >>> .identicon:before {
        border: .5rem solid var(--nimiq-green);
        animation: spin 4s linear infinite;
        transition: border 1s var(--nimiq-ease);
    }

    .cashlink-receive .cashlink.show-loader.sending  >>> .identicon:before {
        border-color: var(--nimiq-gray) var(--nimiq-gray) var(--nimiq-gray) var(--nimiq-light-blue);
    }

    @-moz-keyframes spin { 100% { -moz-transform: rotate(360deg); } }
    @-webkit-keyframes spin { 100% { -webkit-transform: rotate(360deg); } }
    @keyframes spin { 100% { -webkit-transform: rotate(360deg); transform:rotate(360deg); } }

    .cashlink-receive .cashlink-and-url .cashlink-url {
        text-align: center;
        font-size: 3rem;
        line-height: 4rem;
        text-transform: none;
        word-break: break-all;
        max-width: unset;
        max-height: unset;
        opacity: .5;
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

    .page-footer .nq-button.copy {
        padding: unset;
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
        opacity: .7;
    }

    .social-share:hover svg,
    .social-share:focus svg {
        opacity: .8;
    }

    .share-mobile {
        background: none;
        box-shadow: none;
        background-color: rgba(31, 35, 72, 0.07); /* Based on Nimiq Blue */
        color: rgba(31, 35, 72, 0.7);
        transition: background-color 300ms var(--nimiq-ease), color 300ms var(--nimiq-ease);
    }

    .share-mobile:hover,
    .share-mobile:focus {
        background: none;
        background-color: rgba(31, 35, 72, 0.12); /* Based on Nimiq Blue */
        color: rgba(31, 35, 72, 1);
    }
</style>
