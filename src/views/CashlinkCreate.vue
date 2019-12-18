<template>
    <div class="container">
        <SmallPage>

            <transition name="transition-fade">
                <StatusScreen v-if="loading" title="Updating your balances" lightBlue key="loading"/>

                <div v-else-if="!accountOrContractInfo" class="create-cashlink-choose-sender" key="choose-sender">
                    <PageHeader>
                        Choose Sender
                    </PageHeader>
                    <AccountSelector :wallets="processedWallets" :min-balance="1" @account-selected="setSender" @login="login"/>
                </div>

                <div v-else class="create-cashlink" key="create">
                    <SmallPage v-if="optionsOpened" class="overlay fee">
                        <PageBody>
                            <h1 class="nq-h1">Speed up your transaction</h1>
                            <p class="nq-text">By adding a transation fee, you can influence how fast your transaction will be processed.</p>
                            <SelectBar name="fee" ref="fee" :options="FEE_OPTIONS" :selectedValue="feeLunaPerByte" @changed="updateFeePreview"/>
                            <Amount :amount="feePreview" :minDecimals="0" :maxDecimals="5" />
                        </PageBody>
                        <PageFooter>
                            <button class="nq-button light-blue" @click="setFee">Set fee</button>
                        </PageFooter>
                        <CloseButton class="top-right" @click="optionsOpened = false" />
                    </SmallPage>

                    <SmallPage v-if="openedDetails !== Details.NONE" class="overlay">
                        <AccountDetails
                            :address="accountOrContractInfo.address.toUserFriendlyAddress()"
                            :label="accountOrContractInfo.label"
                            :balance="availableBalance"
                            @close="openedDetails = Details.NONE"/>
                    </SmallPage>

                    <PageHeader :backArrow="!request.senderAddress" @back="reset">
                        Create a Cashlink
                        <a href="javascript:void(0)" class="nq-blue options-button" @click="optionsOpened = true">
                            <SettingsIcon/>
                        </a>
                    </PageHeader>

                    <PageBody ref="createCashlinkTooltipTarget">
                        <div class="sender-and-recipient">
                            <Account layout="column"
                                class="sender"
                                :address="accountOrContractInfo.address.toUserFriendlyAddress()"
                                :label="accountOrContractInfo.label"
                                @click.native="openedDetails = Details.SENDER"/>
                            <ArrowRightIcon class="nq-light-blue arrow"/>
                            <Account layout="column"
                                label="New Cashlink"
                                :displayAsCashlink="true"/>
                        </div>
                        <AmountWithFee ref="amountWithFee" :available-balance="availableBalance" v-model="liveAmountAndFee"/>
                        <div class="message-with-tooltip">
                            <LabelInput class="message" placeholder="Add a message..." :vanishing="true" :maxBytes="64" v-model="message" />
                            <Tooltip ref="tooltip" :reference="$refs.createCashlinkTooltipTarget">
                                This message will be stored in the Cashlink.
                                It won’t be part of the public Blockchain and might get lost after the Cashlink was claimed.
                            </Tooltip>
                        </div>
                    </PageBody>

                    <PageFooter>
                        <button class="nq-button light-blue"
                            :disabled="liveAmountAndFee.amount === 0 || !liveAmountAndFee.isValid"
                            @click="sendTransaction">
                            Create Cashlink
                        </button>
                    </PageFooter>
                </div>
            </transition>

        </SmallPage>

        <button class="global-close nq-button-s" @click="close">
            <ArrowLeftSmallIcon/>
            Back to {{request.appName}}
        </button>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Watch } from 'vue-property-decorator';
import { Getter, Mutation, State } from 'vuex-class';
import Cashlink from '../lib/Cashlink';
import staticStore, { Static } from '../lib/StaticStore';
import StatusScreen from '../components/StatusScreen.vue';
import { ERROR_CANCELED } from '../lib/Constants';
import { State as RpcState } from '@nimiq/rpc';
import { loadNimiq } from '../lib/Helpers';
import { AccountInfo } from '../lib/AccountInfo';
import { RequestType, ParsedCashlinkRequest } from '../lib/RequestTypes';
import { NetworkClient } from '@nimiq/network-client';
import { WalletStore } from '../lib/WalletStore';
import { WalletInfo } from '../lib/WalletInfo';
import { ContractInfo, VestingContractInfo } from '../lib/ContractInfo';
import KeyguardClient from '@nimiq/keyguard-client';
import Config from 'config';
import {
    Account,
    AccountDetails,
    AccountSelector,
    Amount,
    AmountWithFee,
    ArrowLeftSmallIcon,
    ArrowRightIcon,
    CloseButton,
    LabelInput,
    PageBody,
    PageFooter,
    PageHeader,
    SelectBar,
    SettingsIcon,
    SmallPage,
    Tooltip,
} from '@nimiq/vue-components';

enum Details {
    NONE,
    SENDER,
    RECIPIENT, // used to send the contact for the final recipient once available
}

@Component({components: {
    Account,
    AccountDetails,
    AccountSelector,
    Amount,
    AmountWithFee,
    ArrowLeftSmallIcon,
    ArrowRightIcon,
    CloseButton,
    LabelInput,
    PageBody,
    PageFooter,
    PageHeader,
    SelectBar,
    SettingsIcon,
    SmallPage,
    StatusScreen,
    Tooltip,
}})
export default class CashlinkCreate extends Vue {
    public $refs!: {
        createCashlinkTooltipTarget: PageBody,
        amountWithFee: AmountWithFee,
        fee: SelectBar,
    };

    @Static private request!: ParsedCashlinkRequest;
    @Static private rpcState!: RpcState;

    @State private wallets!: WalletInfo[];

    @Getter private processedWallets!: WalletInfo[];
    @Getter private findWalletByAddress!: (address: string, includeContracts: boolean) => WalletInfo | undefined;
    @Getter private findWallet!: (id: string) => WalletInfo | undefined;

    @Mutation('addWallet') private $addWallet!: (walletInfo: WalletInfo) => any;

    private nimiqLoadedPromise?: Promise<void>;
    private balanceUpdatedPromise?: Promise<void>;
    private loading: boolean = false;

    private liveAmountAndFee: {amount: number, fee: number, isValid: boolean} = {
        amount: 0,
        fee: 0,
        isValid: false,
    };
    private feeLunaPerByte: number = 0;
    private feeLunaPerBytePreview: number = 0;
    private message = '';

    private accountOrContractInfo: AccountInfo | ContractInfo | null = null;

    private optionsOpened = false;
    private openedDetails = Details.NONE;

    private get availableBalance() {
        if (this.accountOrContractInfo && this.accountOrContractInfo.balance) {
            return this.accountOrContractInfo.balance;
        }
        return 0;
    }

    public async created() {
        if (this.request.cashlinkAddress) {
            this.$rpc.routerReplace(`${RequestType.CASHLINK}-manage`);
            return;
        }

        if (!NetworkClient.hasInstance()) {
            NetworkClient.createInstance(Config.networkEndpoint);
        }

        this.loading = !this.request.senderAddress || !this.request.senderBalance;

        this.nimiqLoadedPromise = loadNimiq();
        this.balanceUpdatedPromise = this.updateBalances();
        if (this.loading) {
            this.balanceUpdatedPromise.then(() => this.loading = false);
        }

        if (this.request.senderAddress) {
            if (!this.request.senderBalance) {
                await this.balanceUpdatedPromise;
            }

            this.setSender(null, this.request.senderAddress.toUserFriendlyAddress());
            // If a balance was given in the request use it until the balance update finishes.
            // The given balance in the request takes precedence over the currently stored (before the update)
            // balance in the store.
            if (this.request.senderBalance) {
                this.accountOrContractInfo!.balance = this.request.senderBalance;
            }
        }
    }

    private setSender(walletId: string | null, address: string) {
        const wallet = walletId
            ? this.findWallet(walletId)
            : this.findWalletByAddress(address, true);
        if (!wallet) {
            this.$rpc.reject(new Error('WalletId not found!'));
            return;
        }

        this.accountOrContractInfo = wallet.accounts.get(address)
            || wallet.findContractByAddress(Nimiq.Address.fromUserFriendlyAddress(address))!;
    }

    private async updateBalances() {
        if (this.balanceUpdatedPromise) {
            return this.balanceUpdatedPromise;
        }

        await NetworkClient.Instance.init();

        const wallets = this.wallets.slice(0);
        let addresses: string[] = [];
        let accountsAndContracts: Array<AccountInfo | ContractInfo> = [];

        if (!this.request.senderAddress) { // No senderAccount in the request
            accountsAndContracts = wallets.reduce((acc, wallet) => {
                acc.push(...wallet.accounts.values());
                acc.push(...wallet.contracts);
                return acc;
            }, [] as Array<AccountInfo | ContractInfo>);

            // Reduce userfriendly addresses from that
            addresses = accountsAndContracts.map((accountOrContract) => accountOrContract.userFriendlyAddress);
        } else {
            const wallet = this.findWalletByAddress(this.request.senderAddress.toUserFriendlyAddress(), true);
            if (!wallet) {
                this.$rpc.reject(new Error('WalletId not found!'));
                return;
            }

            const accountOrContractInfo = wallet.accounts.get(this.request.senderAddress.toUserFriendlyAddress())
                || wallet.findContractByAddress(this.request.senderAddress)!;

            accountsAndContracts.push(accountOrContractInfo);
            addresses.push(accountOrContractInfo.userFriendlyAddress);
        }

        const balances = await NetworkClient.Instance.getBalance(addresses);

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
    }

    private updateFeePreview(fee: number) {
        this.feeLunaPerBytePreview = fee;
    }

    private setFee() {
        this.optionsOpened = false;
        this.feeLunaPerByte = this.$refs.fee!.value;
        this.liveAmountAndFee.fee = this.fee;
    }

    private get fee(): number {
        return 171 * this.feeLunaPerByte; // 166 + 5 bytes extraData for funding a cashlink
    }

    private get feePreview(): number {
        return 171 * this.feeLunaPerBytePreview; // 166 + 5 bytes extraData for funding a cashlink
    }

    private async sendTransaction() {
        const loadingTimeout = window.setTimeout(() => this.loading = true, 10);

        await Promise.all([this.balanceUpdatedPromise, this.nimiqLoadedPromise]);

        window.clearTimeout(loadingTimeout);

        if (!this.liveAmountAndFee.isValid && this.liveAmountAndFee.amount > 0) {
            this.loading = false;
            return;
        }

        const cashlink = await Cashlink.create();
        cashlink.networkClient = NetworkClient.Instance;
        cashlink.value = this.liveAmountAndFee.amount;
        cashlink.message = this.message;
        const fundingDetails = cashlink.getFundingDetails();
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
            recipientType: Nimiq.Account.Type.BASIC,
            fee: this.fee,
            validityStartHeight,
        });
        staticStore.keyguardRequest = request;
        staticStore.cashlink = cashlink;
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

    private reset() {
        this.liveAmountAndFee.isValid = false;
        this.accountOrContractInfo = null;
    }

    @Watch('accountOrContractInfo')
    @Watch('openedDetails')
    @Watch('optionsOpened')
    private focus(newValue: boolean | Details | AccountInfo | ContractInfo) {
        if ((typeof newValue === 'boolean' && newValue === false)
            || (typeof newValue === 'number' && newValue === Details.NONE)
            || (typeof newValue === 'object' && newValue !== null)) {
            Vue.nextTick(() => this.$refs.amountWithFee!.focus());
        }
    }

    private data() {
        return {
            FEE_OPTIONS: [{
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

    .container > .small-page {
        position: relative;
        overflow: hidden;
    }

    .status-screen {
        position: absolute;
        transition: opacity .3s;
    }

    .create-cashlink,
    .create-cashlink-choose-sender {
        position: absolute;
        width: 100%;
        height: 100%;
        transition: opacity .3s;
        display: flex;
        flex-direction: column;
    }

    .page-footer .nq-button {
        margin-top: 0;
    }

    .create-cashlink .page-body {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-around;
        opacity: 1;
        padding-bottom: 2rem;
        padding-top: 0;
        filter: blur(0px);
    }

    .create-cashlink .page-body > .nq-label {
        margin-top: 6rem;
        margin-bottom: 3rem;
    }

    .sender-and-recipient {
        display: flex;
        align-items: center;
        width: 100%;
    }

    .sender-and-recipient .arrow {
        font-size: 3rem;
        margin-top: -6.5rem;
    }

    .options-button {
        position: absolute;
        top: 4rem;
        right: 4rem;
        opacity: .25;
        font-size: 3.625rem;
        transition: opacity .3s var(--nimiq-ease);
    }

    .options-button:hover {
        opacity: 1;
    }

    .sender-and-recipient >>> .account {
        color: inherit;
        text-decoration: none;
        width: calc(50% - 1.1235rem);
    }

    .sender-and-recipient .account.sender {
        cursor: pointer;
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

    .create-cashlink .message-with-tooltip {
        display: flex;
        align-items: center;
        max-width: 100%;
    }

    .page-body >>> .tooltip-box {
        font-size: 1.75rem;
        font-weight: 600;
        line-height: 1.49;
    }

    .create-cashlink .tooltip {
        font-size: 3rem;
        margin: 1rem 1rem 0;
    }

    .create-cashlink .tooltip >>> a.top::after {
        bottom: calc(1em + 0.75rem);
    }

    .create-cashlink .tooltip:not(.active) >>> a svg {
        color: rgba(31, 35, 72, 0.25) !important;
    }

    .create-cashlink .message {
        margin-top: 1rem;
        flex-grow: 1;
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

    .overlay.fee .amount {
        margin-top: 3rem;
    }

    .overlay.fee p {
        text-align: center;
        margin-bottom: 4rem;
        margin-top: .5rem;
    }

    .label-input {
        flex-grow: 1;
    }

    .amount-with-fee {
        flex-grow: 1;
        border-top: .125rem solid var(--nimiq-highlight-bg);
        padding-top: 2rem;
        justify-content: center;
    }

    .create-cashlink .page-body >>> .amount-with-fee input,
    .create-cashlink .page-body >>> .amount-with-fee .nim,
    .create-cashlink .page-body >>> .amount-with-fee .fee-section,
    .create-cashlink .page-body >>> .label,
    .create-cashlink .page-body >>> .identicon,
    .create-cashlink .page-body >>> .message-with-tooltip input,
    .create-cashlink .page-body >>> .tooltip,
    .create-cashlink .page-footer >>> button {
        transition: filter .3s, opacity .3s;
        filter: blur(0px);
        opacity: 1;
    }

    .create-cashlink .page-footer >>> button {
        transition: filter .3s var(--nimiq-ease), opacity .3s var(--nimiq-ease), transform .45s var(--nimiq-ease);
    }

    /* these elements are too small to make a notable difference in the blurred background */
    .create-cashlink .page-body >>> .arrow,
    .create-cashlink .overlay ~ .page-header >>> a { /* back button and fee button */
        opacity: 0;
    }

    .create-cashlink .overlay ~ .page-body,
    .create-cashlink .overlay ~ .page-body >>> .account,
    .create-cashlink .overlay ~ .page-body >>> .label-input {
        overflow: visible; /** needed for ugly hard lines to disappear */
    }

    .create-cashlink .overlay ~ .page-header >>> h1,
    .create-cashlink .overlay ~ .page-body >>> .amount-with-fee input,
    .create-cashlink .overlay ~ .page-body >>> .amount-with-fee .nim,
    .create-cashlink .overlay ~ .page-body >>> .amount-with-fee .fee-section,
    .create-cashlink .overlay ~ .page-body >>> .label,
    .create-cashlink .overlay ~ .page-body >>> .identicon,
    .create-cashlink .overlay ~ .page-body >>> .message-with-tooltip input,
    .create-cashlink .overlay ~ .page-body >>> .tooltip,
    .create-cashlink .overlay ~ .page-footer >>> button {
        opacity: .5;
        filter: blur(20px);
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
