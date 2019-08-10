<template>
    <div class="container">

        <SmallPage v-if="loading">
            <StatusScreen title="Updating your balances"/>
        </SmallPage>

        <SmallPage v-else-if="!accountOrContractInfo" class="send-tx">
            <PageHeader>
                Choose Sender
            </PageHeader>
            <AccountSelector :wallets="processedWallets" @account-selected="setSender" @login="login" :min-balance="1"/>
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
                    :address="details === Details.SENDER ? accountOrContractInfo.address.toUserFriendlyAddress() : recipient.address"
                    :label="details === Details.SENDER ? accountOrContractInfo.label : recipient.label"
                    @close="details = Details.CLOSED"
                    />
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
                            :address="accountOrContractInfo.address.toUserFriendlyAddress()"
                            :label="accountOrContractInfo.label"/>
                    </a>
                    <div class="arrow-wrapper"><ArrowRightIcon class="nq-light-blue" /></div>
                    <a class="disabled">
                        <Account layout="column"
                            :address="accountOrContractInfo.address.toUserFriendlyAddress()"
                            :displayAsCashlink="true"
                            label="New Cashlink"/>
                    </a>
                </div>
                <AmountInput class="value" :vanishing="true" placeholder="0.00" :maxFontSize="8" v-model="value" ref="amountInput" />
                <LabelInput :vanishing="true" placeholder="Add a message..." :maxBytes="64" v-model="message" />
            </PageBody>

            <PageFooter>
                <button class="nq-button light-blue"
                    :disabled="value === 0 || checkInsufficientBalance()"
                    @click="sendTransaction">
                    {{buttonText}}
                </button>
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
import { ContractInfo, VestingContractInfo } from '../lib/ContractInfo';
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

    @Mutation('addWallet') private $addWallet!: (walletInfo: WalletInfo) => any;

    private nimiqLoaded?: Promise<void>;
    private balanceUpdated?: Promise<void>;
    private loading: boolean = false;

    private value = 0;
    private fee = 0;
    private message = '';

    private accountOrContractInfo?: AccountInfo | ContractInfo | null = null;

    private optionsOpened = false;
    private details = Details.CLOSED;

    public async created() {
        if (this.request.cashlinkAddress) {
            this.$router.replace(`/${RequestType.CASHLINK}/manage`);
            return;
        }

        if (!this.request.senderAddress || !this.request.senderBalance) {
            this.loading = true;
            await this.initNetwork();
        }

        this.nimiqLoaded = loadNimiq();

        if (this.request.senderAddress) {
            const wallet = this.findWalletByAddress(
                this.request.senderAddress.toUserFriendlyAddress(),
                true,
            );
            if (wallet) {
                // In case the loading state is active the balance update must be waited upon
                if (this.loading) {
                    await this.balanceUpdated!;
                    this.loading = false;
                }
                await this.setSender(wallet.id, this.request.senderAddress.toUserFriendlyAddress());
            }
        }
        // In case the loading state is active the balance update must be waited upon
        if (this.loading) {
            this.balanceUpdated!.then(() => this.loading = false);
        }
    }

    private async setSender(walletId: string, address: string) {
        const wallet = this.findWallet(walletId);
        if (wallet) {
            this.accountOrContractInfo = wallet.accounts.get(address)
                || wallet.findContractByAddress(Nimiq.Address.fromUserFriendlyAddress(address));
            await this.initNetwork();

            (this.$refs.amountInput as AmountInput).focus();
        }
    }

    private async initNetwork() {
        const network = NetworkClient.Instance;
        await network.init();
        this.balanceUpdated = this.balanceUpdated || new Promise((resolve) => {
            const wallets = this.processedWallets.slice(0);
            let addresses: string[] = [];
            let accountsAndContracts = Array<AccountInfo | ContractInfo>();
            if (!this.accountOrContractInfo) { // No senderAccount in the request
                accountsAndContracts = wallets.reduce((acc, wallet) => {
                    acc.push(...wallet.accounts.values());
                    acc.push(...wallet.contracts);
                    return acc;
                }, [] as Array<AccountInfo | ContractInfo>);
                // Reduce userfriendly addresses from that
                addresses = accountsAndContracts.map((accountOrContract) => accountOrContract.userFriendlyAddress);
            } else {
                accountsAndContracts.push(this.accountOrContractInfo);
                addresses.push(this.accountOrContractInfo.userFriendlyAddress);
            }
            network.connectPico(addresses).then( async (balances) => {
                for (const accountOrContract of accountsAndContracts) {
                    const balance = balances.get(accountOrContract.userFriendlyAddress);
                    if (balance === undefined) continue;

                    if ('type' in accountOrContract && accountOrContract.type === Nimiq.Account.Type.VESTING) {
                        // Calculate available amount for vesting contract
                        accountOrContract.balance =
                            (accountOrContract as VestingContractInfo).calculateAvailableAmount(
                                NetworkClient.Instance.headInfo.height,
                                Nimiq.Policy.coinsToSatoshis(balance),
                            );
                    } else {
                        accountOrContract.balance = Nimiq.Policy.coinsToSatoshis(balance);
                    }
                }
                // Store updated wallets
                for (const wallet of wallets) {
                    // Update IndexedDB
                    await WalletStore.Instance.put(wallet);

                    // Update Vuex
                    this.$addWallet(wallet);
                }
                resolve();
            });
        });
    }

    @Watch('sender.accountInfo.balance')
    private checkInsufficientBalance() {
        if (this.accountOrContractInfo && this.accountOrContractInfo.balance) {
            return this.value + this.fee > this.accountOrContractInfo.balance;
        }
        return true; // Not insufficient specifically but undefined.
    }

    private setFee() {
        this.optionsOpened = false;
        this.fee = (this.$refs.fee as SelectBar).value;
    }

    private sendTransaction() {
        let loadingOngoing = true;
        window.setTimeout(() => this.loading = loadingOngoing, 10);

        Promise.all([this.balanceUpdated, this.nimiqLoaded]).then(async () => {
            loadingOngoing = false;
            if (this.checkInsufficientBalance()) {
                this.loading = false;
                return;
            }

            const cashlink = await Cashlink.create();
            cashlink.networkClient = NetworkClient.Instance;
            cashlink.value = this.value;
            cashlink.message = this.message;
            const fundingDetails = cashlink!.getFundingDetails();
            const senderAccount = this.findWalletByAddress(this.accountOrContractInfo!.userFriendlyAddress, true)!;

            const validityStartHeight = NetworkClient.Instance.headInfo.height + 1;
            const request: KeyguardClient.SignTransactionRequest = Object.assign({}, fundingDetails, {
                shopOrigin: this.rpcState.origin,
                appName: this.request.appName,

                keyId: senderAccount.keyId,
                keyPath: senderAccount.findSignerForAddress(this.accountOrContractInfo!.address)!.path,
                keyLabel: senderAccount.label,

                sender: this.accountOrContractInfo!.address.serialize(),
                senderType: (this.accountOrContractInfo as ContractInfo).type
                    ? (this.accountOrContractInfo as ContractInfo).type
                    : Nimiq.Account.Type.BASIC,
                senderLabel: this.accountOrContractInfo!.label,
                recipientLabel: 'New Cashlink',
                recipientType: Nimiq.Account.Type.BASIC,
                fee: this.fee,
                validityStartHeight,
            });
            staticStore.keyguardRequest = request;
            staticStore.cashlink = cashlink!;
            const client = this.$rpc.createKeyguardClient();
            client.signTransaction(request);
        });
    }

    private login() {
        staticStore.originalRouteName = RequestType.CASHLINK;
        this.$rpc.routerPush(RequestType.ONBOARD);
    }

    private close() {
        this.$rpc.reject(new Error(ERROR_CANCELED));
    }

    private get buttonText() {
        return this.checkInsufficientBalance()
            ? 'Insufficient Funds'
            : 'Create Cashlink';
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
