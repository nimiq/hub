<template>
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
                :address="details === Details.SENDER ? sender.address : recipient.address"
                :editable="details === Details.SENDER"
                :label="details === Details.SENDER ? sender.label : recipient.label"
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
                    <Account layout="column" :address="sender.address" :label="sender.label"/>
                </a>
                <div class="arrow-wrapper"><ArrowRightIcon class="nq-light-blue" /></div>
                <a class="disabled">
                    <Account layout="column" :label="cashlink.contactName" :address="cashlink.address.toUserFriendlyAddress()"/>
                </a>
            </div>
            <AmountInput class="value" :vanishing="true" placeholder="0.00" :maxValue="sender.balance" :maxFontSize="8" :value="0" @changed="setValue" ref="valueInput" />
            <LabelInput :vanishing="true" placeholder="Add a public message..." :maxBytes="64" @changed="setMessage" />
        </PageBody>

        <PageFooter>
            <button class="nq-button light-blue" :disabled="!cashlink || cashlink.value === null" @click="sendTransaction">Create Cashlink</button>
        </PageFooter>
    </SmallPage>
</template>

<script lang="ts">
import { Component, Vue, Watch } from 'vue-property-decorator';
import { Getter, Mutation } from 'vuex-class';
import Cashlink from '../lib/Cashlink';
import { CashlinkState } from '@/lib/PublicRequestTypes';
import staticStore, { Static } from '@/lib/StaticStore';
import StatusScreen from '../components/StatusScreen.vue';
import { State as RpcState } from '@nimiq/rpc';
import HubApi from '../../client/HubApi';
import { loadNimiq } from '../lib/Helpers';
import { RequestType, ParsedCashlinkRequest } from '../lib/RequestTypes';
import { NetworkClient } from '@nimiq/network-client';
import { WalletStore } from '../lib/WalletStore';
import { WalletInfo, WalletType } from '../lib/WalletInfo';
import { ContractInfo } from '../lib/ContractInfo';
import KeyguardClient from '@nimiq/keyguard-client';
import {
    SmallPage,
    PageBody,
    PageFooter,
    PageHeader,
    AmountInput,
    Account,
    LabelInput,
    SettingsIcon,
    ArrowRightIcon,
    AccountDetails,
    AccountSelector,
    SelectBar,
    CloseIcon } from '@nimiq/vue-components';

enum Details {
    CLOSED,
    SENDER,
    RECIPIENT, // used to send the contact for the final recipient once available
}

@Component({components: {
    PageBody,
    SmallPage,
    PageHeader,
    PageFooter,
    AmountInput,
    Account,
    AccountSelector,
    LabelInput,
    SettingsIcon,
    StatusScreen,
    ArrowRightIcon,
    AccountDetails,
    CloseIcon,
    SelectBar,
}})
export default class CashlinkCreate extends Vue {
    @Static private request!: ParsedCashlinkRequest;
    @Static private rpcState!: RpcState;
    @Getter private processedWallets!: WalletInfo[];

    private cashlink: Cashlink | null = null;
    private sender: {
        address: string,
        label: string,
        walletId: string,
        balance?: number,
        keyPath: string,
    } | null = null;
    private fee = 0;

    private optionsOpened = false;
    private details = Details.CLOSED;

    private label = '';

    public async created() {
        if (this.request.senderAddress) {
            // Load sender information, otherwise the select sender Address screen is shown
            for (const walletInfo of this.processedWallets) {
                if (walletInfo.accounts.has(this.request.senderAddress.toUserFriendlyAddress())) {
                    const foundAddress = walletInfo.accounts.get(this.request.senderAddress.toUserFriendlyAddress());
                    if (foundAddress) {
                        this.sender = {
                            address: this.request.senderAddress.toUserFriendlyAddress(),
                            label: foundAddress.label,
                            walletId: walletInfo.id,
                            balance: foundAddress.balance,
                            keyPath: foundAddress.path,
                        };
                        this.label = foundAddress.label;
                        break;
                    }
                }
            }
        }
        await loadNimiq();
        const network = NetworkClient.Instance;
        await network.init();
        await network.connectPico();

        this.cashlink = await Cashlink.create();
        this.cashlink.contactName = 'New Cashlink';
        this.cashlink.networkClient = network;
        network.subscribe(this.cashlink.address.toUserFriendlyAddress());
    }

    private async setSender(walletId: string, address: string) {
        const wallet = this.processedWallets.find((value, index) => value.id === walletId);
        if (wallet) {
            const foundAddress = wallet.accounts.get(address);
            if (foundAddress) {
                this.sender = {
                    address,
                    label: foundAddress.label,
                    walletId,
                    balance: foundAddress.balance,
                    keyPath: foundAddress.path,
                };
                this.label = foundAddress.label;
            }
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
        const wallet = this.processedWallets.find((value, index) => value.id === this.sender!.walletId);
        if (wallet) {
            const foundAddress = wallet.accounts.get(this.sender!.address);
            if (foundAddress) {
                foundAddress.label = this.label;
                wallet.accounts.set(this.sender!.address, foundAddress);
                await WalletStore.Instance.put(wallet);
                this.sender!.label = this.label;
                this.details = Details.CLOSED;
            }
        }
    }

    private sendTransaction() {
        const fundingDetails = this.cashlink!.getFundingDetails();
        const senderAccount = this.processedWallets.find((wallet: WalletInfo) => wallet.id === this.sender!.walletId)!;
        const senderContract = senderAccount.findContractByAddress(
            Nimiq.Address.fromUserFriendlyAddress(this.sender!.address),
        );

        const validityStartHeight = NetworkClient.Instance.headInfo.height + 1;
        const request: KeyguardClient.SignTransactionRequest = Object.assign({}, fundingDetails, {
            shopOrigin: this.rpcState.origin,
            appName: this.request.appName,

            keyId: senderAccount.keyId,
            keyPath: this.sender!.keyPath,
            keyLabel: this.sender!.label,

            sender: (senderContract
                ? senderContract.address
                : Nimiq.Address.fromUserFriendlyAddress(this.sender!.address)
            ).serialize(),
            senderType: senderContract ? senderContract.type : Nimiq.Account.Type.BASIC,
            senderLabel: (senderContract || this.sender!).label,
            recipientLabel: this.cashlink!.contactName,
            recipientType: Nimiq.Account.Type.BASIC,
            fee: this.fee,
            validityStartHeight,
        });

        staticStore.keyguardRequest = request;
        staticStore.cashlink = this.cashlink!;
        const client = this.$rpc.createKeyguardClient();
        client.signTransaction(request);
        return;
    }

    private login() {
        console.log('login');
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

    .address-display {
        margin-top: 3rem;
    }

    .sender-and-recipient {
        display: flex;
        align-items: center;
        width: 100%;
    }

    .arrow-wrapper {
        font-size: 3rem;
        margin-top: -3.25rem;
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

    .sender-and-recipient .account .identicon {
        width: 9rem;
        height: 9rem;
    }

    .create-cashlink .value {
        display: flex;
        align-items: baseline;
        height: 14.5rem; /* 12.5rem height + 2rem padding */
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
</style>
