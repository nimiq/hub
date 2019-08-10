<template>
    <div class="container pad-bottom" v-if="retrievedCashlink">
        <SmallPage class="cashlink-receive">
            <PageBody>
                <transition name="transition-fade">
                    <div v-if="isTxSent" class="nq-green cashlink-status"><CheckmarkIcon/> Cashlink created</div>
                </transition>
                <button class="nq-button-s close" @click="close">done</button>
                <div class="cashlink-and-url">
                    <Account :displayAsCashlink="true" layout="column" :class="{sending: !isTxSent}"/>
                    <div class="cashlink-url">{{link}}</div>
                </div>
            </PageBody>
            <PageFooter v-if="nativeShareAvailable">
                <button class="nq-button nq-light-blue-bg copy" @click="share">
                    share
                </button>
            </PageFooter>
            <PageFooter v-else>
                <button class="nq-button nq-light-blue-bg copy" @click="copy" ref="copyButton">
                    <span v-if="copied"><CheckmarkIcon /> Copied</span>
                    <span v-else>Copy</span>
                </button>
                <a class="nq-button" :href="telegram" target="_blank">
                    <svg width="29" height="25" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path opacity=".6" d="M28.537.528c-.103-.308-.224-.397-.416-.472-.42-.164-1.124.084-1.124.084S1.943 9.496.516 10.534c-.308.225-.416.351-.467.505-.247.74.523 1.062.523 1.062l6.458 2.185s.023.005.056.005l3.024 8.7s.275.585.61.777c.01.01.024.014.033.023l.028.014c.038.019.08.028.131.028.005 0 .01.005.014.005h.005c.252 0 .658-.22 1.311-.903a56.694 56.694 0 0 1 3.392-3.227c2.221 1.595 4.61 3.354 5.642 4.275.518.463.952.538 1.306.524.98-.038 1.251-1.155 1.251-1.155s4.573-19.09 4.722-21.65c.014-.252.038-.411.038-.584.004-.239-.019-.477-.056-.59zM8.332 13.758l.004-.132c3.463-2.268 13.887-9.089 14.568-9.35.122-.038.21.004.187.093-.308 1.123-11.866 11.797-11.866 11.797s-.042.056-.07.122l-.014-.01-.397 4.398-2.412-6.919z" fill="#1F2348"/>
                    </svg>
                </a>
                <a class="nq-button" :href="mail">
                    <svg width="28" height="24" viewBox="0 0 28 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <g opacity=".6">
                            <path d="M13.9047 11.3644C14.0384 11.4981 14.1721 11.4981 14.3058 11.3644L27.1408 2.80767C27.4082 2.67397 27.5419 2.40658 27.4082 2.13918C27.1408 0.935891 26.0713 0 24.7343 0H2.67397C1.33699 0 0.267397 0.935891 0 2.13918C0 2.40658 0.133699 2.67397 0.401096 2.94137L13.9047 11.3644Z" fill="#1F2348"/>
                            <path d="M15.3754 14.4395C14.5732 14.9743 13.6373 14.9743 12.8351 14.4395L1.06959 6.95235C0.668494 6.81865 0.267398 6.95235 0.133699 7.21975C0 7.35345 0 7.48715 0 7.62085V20.7233C0 22.194 1.20329 23.3973 2.67398 23.3973H24.7343C26.205 23.3973 27.4082 22.194 27.4082 20.7233V7.62085C27.4082 7.21975 27.1408 6.95235 26.7398 6.95235C26.6061 6.95235 26.4724 6.95235 26.3387 7.08605L15.3754 14.4395Z" fill="#1F2348"/>
                        </g>
                    </svg>
                </a>
                <a class="nq-button" :href="whatsapp" target="_blank">
                    <svg width="28" height="28" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path opacity=".6" d="M14 0C6.3 0 0 6.235 0 14c0 2.823.817 5.647 2.45 8L.817 26.706c-.117.235 0 .47.116.588.117.118.35.235.584.118l5.016-1.53C13.067 30 21.7 28 25.783 21.412c1.4-2.235 2.1-4.824 2.1-7.412C28 6.235 21.7 0 14 0zm8.4 19.647c-.817 1.53-2.333 2.47-4.083 2.47-1.4-.117-2.8-.588-3.967-1.176-2.8-1.294-5.25-3.412-7-6.117-2.217-2.942-2.333-5.765-.233-8.118.583-.47 1.4-.706 2.216-.588.584.117 1.167.47 1.4 1.058l.467 1.06c.35.823.7 1.646.7 1.764.233.353.233.823 0 1.177-.35.588-.7 1.176-1.167 1.646a10.68 10.68 0 0 0 2.1 2.471c.934.824 1.984 1.53 3.15 1.883.35-.471.934-1.177 1.167-1.53a1.175 1.175 0 0 1 1.517-.47c.466.117 2.916 1.411 2.916 1.411.35.118.584.353.817.588.467.942.467 1.765 0 2.471z" fill="#1F2348"/>
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
import { SmallPage, PageBody, PageFooter, Account, CheckmarkIcon } from '@nimiq/vue-components';
import StatusScreen from '../components/StatusScreen.vue';
import { NetworkClient } from '@nimiq/network-client';
import { loadNimiq } from '../lib/Helpers';
import Cashlink from '../lib/Cashlink';
import { CashlinkState } from '@/lib/PublicRequestTypes';
import { CashlinkStore } from '../lib/CashlinkStore';
import { State } from 'vuex-class';
import KeyguardClient from '@nimiq/keyguard-client';
import { Cashlink as PublicCashlink } from '../lib/PublicRequestTypes';

@Component({components: {
    Account,
    CheckmarkIcon,
    PageBody,
    PageFooter,
    SmallPage,
    StatusScreen,
}})
export default class CashlinkManage extends Vue {
    @Static private request!: ParsedCashlinkRequest;
    @Static private cashlink!: Cashlink;
    @Static private keyguardRequest!: KeyguardClient.SignTransactionRequest;
    @State private keyguardResult?: KeyguardClient.SignTransactionResult;

    private isTxSent: boolean = false;
    private status: string = 'Connecting to network...';
    private state: StatusScreen.State = StatusScreen.State.LOADING;
    private retrievedCashlink: Cashlink | null = null;
    private copied = false;
    private nativeShareAvailable: boolean = false;

    private async mounted() {
        this.nativeShareAvailable = (!!navigator && !!(navigator as any).share);
        this.retrievedCashlink = this.cashlink;
        if (!this.keyguardResult) {
            // If there is no Keyguard result this is not a freshly funded cashlink
            // and must be retrieved from the store.
            if (this.request.cashlinkAddress) {
                const cashlink = await CashlinkStore.Instance.get(this.request.cashlinkAddress.toUserFriendlyAddress());
                if (cashlink) {
                    this.retrievedCashlink = cashlink;
                    this.isTxSent = true;
                }
            }
        }

        const network = NetworkClient.Instance;
        await network.init();
        await network.connectPico();

        if (!this.isTxSent) {
            if (!this.keyguardResult || !this.keyguardRequest) {
                this.$rpc.reject(new Error('Unexpected: No valid Cashlink;'));
                return;
            }
            // if there was a funding transaction the cashlink is in the static store.
            this.retrievedCashlink.networkClient = network;
            (NetworkClient.Instance).subscribe(this.retrievedCashlink.address.toUserFriendlyAddress());
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
            this.state = StatusScreen.State.SUCCESS;
            await CashlinkStore.Instance.put(this.retrievedCashlink);
            setTimeout(() => this.isTxSent = true, StatusScreen.SUCCESS_REDIRECT_DELAY);
        }
    }

    private get title(): string {
        return this.state === StatusScreen.State.LOADING ? 'Funding your Cashlink' : 'Cashlink funded.';
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
        const selection: Selection = window.getSelection()!;
        const range: Range = window.document.createRange()!;
        selection.removeAllRanges();
        range.selectNode(document.querySelector('.cashlink-url')!);
        selection.addRange(range);
        try {
            window.document.execCommand('copy');
        } catch (err) {
            // do nothing
        }
        selection.removeAllRanges();

        const button = (this.$refs.copyButton as HTMLButtonElement);
        button.classList.remove('nq-light-blue-bg');
        button.classList.add('nq-green-bg');
        this.copied = true;
    }

    private share() {
        (navigator as any).share({
            title: 'Cashlink',
            text: 'Cashlink',
            url: this.link,
        }).catch( (error: Error) => console.log('Error sharing', error));
    }

    private get telegram(): string {
        return `https://telegram.me/share/msg?url=${location.host}&text=${encodeURIComponent(this.link)}`;
    }

    private get mail(): string {
        return `mailto:?subject=Cashlink&body=${encodeURIComponent(this.link)}`;
    }

    private get whatsapp(): string {
        return `https://api.whatsapp.com/send?text=${encodeURIComponent(this.link)}`;
    }
}
</script>

<style scoped>
    .cashlink-receive {
        position: relative
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
        transition: opacity .4s;
    }

    .cashlink-receive .cashlink-and-url {
        height: 100%;
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
    }

    .cashlink-receive .cashlink >>> .identicon {
        width: 18rem;
        height: 18rem;
        padding: 1rem;
        margin-bottom: 1.25rem;
    }

    .cashlink-receive .cashlink >>> .identicon:before {
        border: .5rem solid var(--nimiq-green);
        -webkit-animation:spin 4s linear infinite;
        -moz-animation:spin 4s linear infinite;
        animation:spin 4s linear infinite;
        transition: border 1s ease;
    }

    .cashlink-receive .cashlink.sending  >>> .identicon:before {
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

    .page-footer >>> .nq-button:not(.copy) {
        background: rgba(31,35,72,.07);
        width: 7.5rem;
        padding: 2rem;
        transition: background .4s ease;
    }

    .page-footer >>> .nq-button:not(.copy) svg {
        width: 3.5rem;
        height: 3.5rem;
        transition: opacity .4s ease;
        opacity: .7;
    }

    .page-footer >>> .nq-button:not(.copy):hover,
    .page-footer >>> .nq-button:not(.copy):focus {
        background: rgba(31,35,72,.16);
    }

    .page-footer >>> .nq-button:not(.copy):hover svg,
    .page-footer >>> .nq-button:not(.copy):focus svg {
        opacity: .8;
    }
</style>
