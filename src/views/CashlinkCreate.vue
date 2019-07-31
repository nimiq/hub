<template>
    <div class="container">
        <SmallPage v-if="!sender" class="send-tx">
            <PageHeader>
                Choose Sender
            </PageHeader>
            <AccountSelector :wallets="processedWallets" @account-selected="setSender" @login="login" />
        </SmallPage>

        <SmallPage v-else-if="!cashlink">
            <StatusScreen title="Loading Cashlink"/>
        </SmallPage>

        <SmallPage v-else class="create-cashlink">
            <SmallPage class="overlay fee" v-if="optionsOpened">
                <a href="javascript:void(0)" class="nq-button-s cancel-circle" @click="optionsOpened = false">
                    <CloseIcon/>
                </a>
                <PageBody>
                    <h1 class="nq-h1">Speed up your transaction</h1>
                    <p class="nq-text">By adding a transation fee, you can influence how fast your transaction will be processed.</p>
                    <SelectBar ref="fee" :options="OPTIONS" name="fee" :selectedValue="fee" />
                </PageBody>
                <PageFooter>
                    <button class="nq-button light-blue" @click="setFee">Set fee</button>
                </PageFooter>
            </SmallPage>

            <SmallPage class="overlay" v-if="details !== Details.CLOSED">
                <AccountDetails
                    :address="details === Details.SENDER ? sender.accountInfo.address.toUserFriendlyAddress() : recipient.address"
                    :editable="details === Details.SENDER"
                    :label="details === Details.SENDER ? sender.accountInfo.label : recipient.label"
                    @close="details = Details.CLOSED"
                    @changed="setLabel"
                    />
                <PageFooter>
                    <button class="nq-button light-blue" @click="storeContactAndCloseOverlay">Save Contact</button>
                </PageFooter>
            </SmallPage>

            <PageHeader>
                Create a Cashlink
                <a href="javascript:void(0)" class="nq-blue options-button" @click="optionsOpened = true">
                    <SettingsIcon/>
                </a>
            </PageHeader>

            <PageBody>
                <div class="sender-and-recipient">
                    <a href="javascript:void(0);"  @click="details = Details.SENDER">
                        <Account layout="column"
                            :address="sender.accountInfo.address.toUserFriendlyAddress()"
                            :label="sender.accountInfo.label"/>
                    </a>
                    <div class="arrow-wrapper"><ArrowRightIcon class="nq-light-blue" /></div>
                    <a class="disabled">
                        <Account layout="column"
                            :address="sender.accountInfo.address.toUserFriendlyAddress()"
                            :displayAsCashlink="true"
                            :label="cashlink.contactName"/>
                    </a>
                </div>
                <AmountInput class="value" :vanishing="true" placeholder="0.00" :maxValue="sender.accountInfo.balance" :maxFontSize="8" :value="0" @changed="setValue" ref="valueInput" />
                <LabelInput :vanishing="true" placeholder="Add a public message..." :maxBytes="64" @changed="setMessage" />
            </PageBody>

            <PageFooter>
                <button class="nq-button light-blue" :disabled="!cashlink || cashlink.value === 0" @click="sendTransaction">Create Cashlink</button>
            </PageFooter>
        </SmallPage>

        <button class="global-close nq-button-s" @click="close">
            <ArrowLeftSmallIcon/>
            Back to {{request.appName}}
        </button>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Watch } from 'vue-property-decorator';
import { Getter, Mutation } from 'vuex-class';
import Cashlink from '../lib/Cashlink';
import { CashlinkState } from '@/lib/PublicRequestTypes';
import staticStore, { Static } from '@/lib/StaticStore';
import StatusScreen from '../components/StatusScreen.vue';
import { ERROR_CANCELED } from '../lib/Constants';
import { State as RpcState } from '@nimiq/rpc';
import HubApi from '../../client/HubApi';
import { loadNimiq } from '../lib/Helpers';
import { AccountInfo } from '../lib/AccountInfo';
import { RequestType, ParsedCashlinkRequest } from '../lib/RequestTypes';
import { NetworkClient } from '@nimiq/network-client';
import { WalletStore } from '../lib/WalletStore';
import { WalletInfo, WalletType } from '../lib/WalletInfo';
import { ContractInfo } from '../lib/ContractInfo';
import KeyguardClient from '@nimiq/keyguard-client';
import {
    Account,
    AccountDetails,
    AccountSelector,
    AmountInput,
    ArrowLeftSmallIcon,
    ArrowRightIcon,
    CloseIcon,
    LabelInput,
    PageBody,
    PageFooter,
    PageHeader,
    SelectBar,
    SettingsIcon,
    SmallPage,
} from '@nimiq/vue-components';

enum Details {
    CLOSED,
    SENDER,
    RECIPIENT, // used to send the contact for the final recipient once available
}

@Component({components: {
    Account,
    AccountDetails,
    AccountSelector,
    AmountInput,
    ArrowLeftSmallIcon,
    ArrowRightIcon,
    CloseIcon,
    LabelInput,
    PageBody,
    PageFooter,
    PageHeader,
    SelectBar,
    SettingsIcon,
    SmallPage,
    StatusScreen,
}})
export default class CashlinkCreate extends Vue {
    @Static private request!: ParsedCashlinkRequest;
    @Static private rpcState!: RpcState;

    @Getter private processedWallets!: WalletInfo[];
    @Getter private findWalletByAddress!: (address: string, includeContracts: boolean) => WalletInfo | undefined;
    @Getter private findWallet!: (id: string) => WalletInfo | undefined;

    private cashlink: Cashlink | null = null;
    private fee = 0;

    private sender: {
        accountInfo: AccountInfo,
        walletId: string,
    } | null = null;
    private label = '';

    private optionsOpened = false;
    private details = Details.CLOSED;

    public async created() {
        if (this.request.cashlinkAddress) {
            this.$router.replace(`/${RequestType.CASHLINK}/manage`);
            return;
        }
        if (this.request.senderAddress) {
            const wallet = this.findWalletByAddress(this.request.senderAddress.toUserFriendlyAddress(), true);
            if (wallet) {
                this.sender = {
                    walletId: wallet.id,
                    accountInfo: wallet.accounts.get(this.request.senderAddress.toUserFriendlyAddress())!,
                };
                this.label = this.sender!.accountInfo.label;
            }
        }

        const network = NetworkClient.Instance;
        await network.init();
        await network.connectPico();

        this.cashlink = await Cashlink.create();
        this.cashlink.contactName = 'New Cashlink';
        this.cashlink.networkClient = network;
        network.subscribe(this.cashlink.address.toUserFriendlyAddress());
    }

    private async setSender(walletId: string, address: string) {
        const wallet = this.findWallet(walletId);
        if (wallet) {
            this.sender = {
                walletId: wallet.id,
                accountInfo: wallet.accounts.get(address)!,
            };
            this.label = this.sender!.accountInfo.label;
        }
    }

    private setValue(value: number) {
        this.cashlink!.value = value;
    }

    private setMessage(value: string) {
        this.cashlink!.message = value;
    }

    private setFee() {
        this.optionsOpened = false;
        this.fee = (this.$refs.fee as SelectBar).value;
    }

    private setLabel(label: string) {
        this.label = label;
    }

    private async storeContactAndCloseOverlay() {
        const wallet = this.findWallet(this.sender!.walletId);
        if (wallet) {
            this.sender!.accountInfo.label = this.label;
            wallet.accounts.set(
                this.sender!.accountInfo.address.toUserFriendlyAddress(),
                this.sender!.accountInfo,
            );
            await WalletStore.Instance.put(wallet);
            this.details = Details.CLOSED;
        }
    }

    private sendTransaction() {
        const fundingDetails = this.cashlink!.getFundingDetails();
        const senderAccount = this.findWallet(this.sender!.walletId)!;
        const senderContract = senderAccount.findContractByAddress(
            this.sender!.accountInfo.address,
        );

        const validityStartHeight = NetworkClient.Instance.headInfo.height + 1;
        const request: KeyguardClient.SignTransactionRequest = Object.assign({}, fundingDetails, {
            shopOrigin: this.rpcState.origin,
            appName: this.request.appName,

            keyId: senderAccount.keyId,
            keyPath: this.sender!.accountInfo.path,
            keyLabel: this.sender!.accountInfo.label,

            sender: (senderContract
                ? senderContract.address
                : this.sender!.accountInfo.address
            ).serialize(),
            senderType: senderContract ? senderContract.type : Nimiq.Account.Type.BASIC,
            senderLabel: (senderContract || this.sender!.accountInfo).label,
            recipientLabel: this.cashlink!.contactName,
            recipientType: Nimiq.Account.Type.BASIC,
            fee: this.fee,
            validityStartHeight,
        });

        staticStore.keyguardRequest = request;
        staticStore.cashlink = this.cashlink!;
        const client = this.$rpc.createKeyguardClient();
        client.signTransaction(request);
    }

    private login() {
        staticStore.originalRouteName = RequestType.CASHLINK;
        this.$rpc.routerPush(RequestType.ONBOARD);
    }

    private close() {
        this.$rpc.reject(new Error(ERROR_CANCELED));
    }

    private data() {
            return {
                OPTIONS: [{
                    color: 'nq-light-blue-bg',
                    value: 0,
                    text: 'free',
                    index: 0,
                }, {
                    color: 'nq-green-bg',
                    value: 1,
                    text: 'standard',
                    index: 1,
                }, {
                    color: 'nq-gold-bg',
                    value: 2,
                    text: 'express',
                    index: 2,
                }],
                Details,
            };
        }
}
</script>

<style scoped>
    .create-cashlink {
        position: relative;
    }

    .create-cashlink .page-header,
    .create-cashlink .page-footer {
        transition: opacity .3s;
        opacity: 1;
    }

    .create-cashlink .page-body {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-around;
        transition: filter .4s, opacity .3s;
        opacity: 1;
        -webkit-filter: blur(0px);
        -moz-filter: blur(0px);
        -o-filter: blur(0px);
        -ms-filter: blur(0px);
        filter: blur(0px);
    }

    .create-cashlink .page-body > .nq-label {
        margin-top: 6rem;
        margin-bottom: 3rem;
    }

    .account-details >>> .address-display {
        margin-top: 3rem;
    }

    .sender-and-recipient {
        display: flex;
        align-items: center;
        width: 100%;
    }

    .arrow-wrapper {
        font-size: 3rem;
        margin-top: -6.5rem;
    }

    .options-button {
        position: absolute;
        top: 4rem;
        right: 4rem;
        opacity: .25;
        font-size: 3.625rem;
    }

    .sender-and-recipient a {
        color: inherit;
        text-decoration: none;
        width: calc(50% - 1.1235rem);
    }

    .sender-and-recipient .account >>> .identicon {
        width: 9rem;
        height: 9rem;
    }

    .sender-and-recipient .account >>> .label {
        height: 3em;
    }

    .create-cashlink .value {
        display: flex;
        align-items: baseline;
        height: 14.5rem; /* 12.5rem height + 2rem padding */
        border-top: .125rem solid var(--nimiq-highlight-bg);
        margin-top: 1rem;
        padding-top: 2rem;
    }

    .overlay {
        position: absolute;
        z-index: 2;
        left: 0;
        top: 0;
        margin: 0;
        background: rgba(255, 255, 255, .5);
    }

    .overlay .account-details {
        background: none;
    }

    .overlay.fee .page-body {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
    }

    .overlay.fee p {
        text-align: center;
        margin-bottom: 4rem;
        margin-top: .5rem;
    }

    .overlay .cancel-circle {
        font-size: 3rem;
        position: absolute;
        z-index: 1;
        top: 2rem;
        right: 2rem;
        padding: 0;
        height: unset;
    }
    .overlay .cancel-circle .nq-icon {
        opacity: .2;
        transition: opacity .3s cubic-bezier(0.25, 0, 0, 1);
    }


    .cancel-circle:hover .nq-icon,
    .cancel-circle:active .nq-icon,
    .cancel-circle:focus .nq-icon {
        opacity: .4;
    }

    .create-cashlink .overlay ~ .page-body {
        opacity: .5;
        -webkit-filter: blur(20px);
        -moz-filter: blur(20px);
        -o-filter: blur(20px);
        -ms-filter: blur(20px);
        filter: blur(20px);
    }

    .create-cashlink  .overlay ~ .page-header,
    .create-cashlink  .overlay ~ .page-footer {
        opacity: .05;
    }

    .sender-and-recipient {
        display: flex;
        align-items: center;
        width: 100%;
    }

    .create-cashlink .cashlink >>> .label {
        opacity: .5;
        line-height: 1.5;
    }
</style>
