<template>
    <div v-if="showAccountSelector" class="container">
        <SmallPage>
            <h1 class="nq-h1">{{ $t('Choose an Address') }}</h1>
            <p class="subline nq-text">
                {{ $t('Select an address to sign the transaction with.') }}
            </p>
            <p v-if="balancesUpdating" class="sync-status nq-text">
                <CircleSpinner />
                {{ syncStatus }}
            </p>

            <AccountSelector
                :wallets="processedWallets"
                disableContracts
                :min-balance="request.value + request.fee"
                @account-selected="setAccount"
                @login="() => goToOnboarding(false)"/>
        </SmallPage>

        <GlobalClose />
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { Getter, Mutation, State } from 'vuex-class';
import { SmallPage, AccountSelector, CircleSpinner } from '@nimiq/vue-components';
import { ParsedSignTransactionRequest } from '../lib/RequestTypes';
import KeyguardClient from '@nimiq/keyguard-client';
import staticStore, { Static } from '../lib/StaticStore';
import { WalletInfo } from '../lib/WalletInfo';
import { AccountType, RequestType } from '../../client/PublicRequestTypes';
import GlobalClose from '../components/GlobalClose.vue';
import { NetworkClient } from '../lib/NetworkClient';
import { AccountInfo } from '../lib/AccountInfo';
import { ContractInfo, VestingContractInfo } from '../lib/ContractInfo';
import { WalletStore } from '../lib/WalletStore';

@Component({components: {SmallPage, GlobalClose, AccountSelector, CircleSpinner}})
export default class SignTransaction extends Vue {
    @Static private request!: ParsedSignTransactionRequest;
    @State private wallets!: WalletInfo[];

    @Getter private processedWallets!: WalletInfo[];
    @Getter private findWallet!: (id: string) => WalletInfo | undefined;
    @Getter private findWalletByAddress!: (address: string, includeContracts: boolean) => WalletInfo | undefined;

    @Mutation('addWallet') private $addWallet!: (walletInfo: WalletInfo) => any;
    @Mutation('setActiveAccount') private $setActiveAccount!: (payload: {
        walletId: string,
        userFriendlyAddress: string,
    }) => any;

    private showAccountSelector = false;

    private updateBalancePromise: Promise<void> | null = null;
    private balancesUpdating: boolean = true;
    private network!: NetworkClient;
    private syncStatus = '';

    public created() {
        if (this.request.sender) {
            this.forwardToKeyguard(this.request.sender);
            return;
        }

        // If account not specified / found or is an unsupported Ledger account let the user pick another account.
        // Don't automatically reject to not directly leak the information whether an account exists / is a Ledger.
        this.syncStatus = this.$t('Contacting seed nodes...') as string;
        this.showAccountSelector = true;
        this.initNimiq();
    }

    private async initNimiq() {
        this.network = NetworkClient.Instance;
        await this.network.init();

        this.addConsensusListeners();
        this.updateBalancePromise = this.getBalances().then((balances) => {
            this.balancesUpdating = false;
        });
    }

    private async getBalances(): Promise<Map<string, number>> {
        // Copy wallets to be able to manipulate them
        const wallets = this.wallets.slice(0);

        // Generate a new array with references to the respective wallets' accounts
        const accountsAndContracts = wallets.reduce((acc, wallet) => {
            acc.push(...wallet.accounts.values());
            acc.push(...wallet.contracts);
            return acc;
        }, [] as Array<AccountInfo | ContractInfo>);

        // Reduce userfriendly addresses from that
        const addresses = accountsAndContracts.map((accountOrContract) => accountOrContract.userFriendlyAddress);

        // Get balances through pico consensus, also triggers head-change event
        const balances: Map<string, number> = await this.network.getBalance(addresses);

        // Update accounts/contracts with their balances
        // (The accounts are still references to themselves in the wallets' accounts maps)
        for (const accountOrContract of accountsAndContracts) {
            const balance = balances.get(accountOrContract.userFriendlyAddress);
            if (balance === undefined) continue;

            if ('type' in accountOrContract && accountOrContract.type === Nimiq.AccountType.Vesting) {
                // Calculate available amount for vesting contract
                accountOrContract.balance = (accountOrContract as VestingContractInfo)
                    .calculateAvailableAmount(balance);
            } else {
                accountOrContract.balance = balance;
            }
        }

        // Store updated wallets
        for (const wallet of wallets) {
            // Update IndexedDB
            await WalletStore.Instance.put(wallet);

            // Update Vuex
            this.$addWallet(wallet);
        }

        return balances;
    }

    private async addConsensusListeners() {
        const client = await this.network.innerClient!;
        client.addConsensusChangedListener((consensus) => {
            if (consensus === 'connecting') {
                this.syncStatus = this.$t('Contacting seed nodes...') as string;
            } else if (consensus === 'syncing') {
                this.syncStatus = this.$t('Syncing consensus...') as string;
            } else if (consensus === 'established') {
                this.syncStatus = this.$t('Updating balances...') as string;
            }
        });
    }

    private async setAccount(walletId: string, address: string, isFromRequest = false) {
        const walletInfo = this.findWallet(walletId);
        if (!walletInfo) {
            // We can also return an error here and when checking the address below,
            // but it would enable malicious sites to query for stored walletIds and addresses.
            // Instead we quietly ignore any unavailable pre-set walletId and address and give
            // the user the option to chose as if it was not pre-set.
            this.showAccountSelector = true;
            if (!isFromRequest) throw new Error(`UNEXPECTED: Selected walletId not found: ${walletId}`);
            return;
        }

        const accountInfo = walletInfo.accounts.get(address);
        if (!accountInfo) {
            this.showAccountSelector = true;
            if (!isFromRequest) throw new Error(`UNEXPECTED: Selected account not found: ${address}`);
            return;
        }

        if (this.showAccountSelector) {
            // set active account if user selected the account himself
            this.$setActiveAccount({
                walletId: walletInfo.id,
                userFriendlyAddress: accountInfo.userFriendlyAddress,
            });
        }

        if (walletInfo.type === AccountType.LEDGER) {
            // If the user selected a Ledger account, we redirect to the Ledger signing flow.
            this.request.sender = accountInfo.address;
            this.$router.push({name: `${RequestType.SIGN_TRANSACTION}-ledger`});
        } else {
            // Forward to Keyguard
            this.forwardToKeyguard(accountInfo.address);
        }
    }

    private goToOnboarding(useReplace?: boolean) {
        // Redirect to onboarding
        staticStore.originalRouteName = RequestType.SIGN_TRANSACTION;
        if (useReplace) {
            this.$router.replace({name: RequestType.ONBOARD});
        } else {
            this.$router.push({name: RequestType.ONBOARD});
        }
    }

    private forwardToKeyguard(sender: NonNullable<ParsedSignTransactionRequest['sender']>) {
        // Forward user through Hub to Keyguard

        let senderAddress: Nimiq.Address;
        let senderLabel: string | undefined;
        let senderType: Nimiq.AccountType | undefined;
        let keyId: string;
        let keyPath: string;
        let keyLabel: string | undefined;

        if (sender instanceof Nimiq.Address) {
            // existence checked in RpcApi
            const senderAccount = this.findWalletByAddress(sender.toUserFriendlyAddress(), true)!;
            const senderContract = senderAccount.findContractByAddress(sender);
            const signer = senderAccount.findSignerForAddress(sender)!;

            senderAddress = sender;
            senderLabel = (senderContract || signer).label;
            senderType = senderContract ? senderContract.type : Nimiq.AccountType.Basic;
            keyId = senderAccount.keyId;
            keyPath = signer.path;
            keyLabel = senderAccount.labelForKeyguard;
        } else {
            ({
                address: senderAddress,
                label: senderLabel,
                type: senderType,
                signerKeyId: keyId,
                signerKeyPath: keyPath,
                walletLabel: keyLabel,
            } = sender);
        }

        const request: KeyguardClient.SignTransactionRequest = {
            layout: 'standard',
            appName: this.request.appName,

            keyId,
            keyPath,
            keyLabel,

            sender: senderAddress.serialize(),
            senderLabel,
            senderType: senderType || Nimiq.AccountType.Basic,
            recipient: this.request.recipient.serialize(),
            recipientType: this.request.recipientType,
            recipientLabel: this.request.recipientLabel,
            recipientData: this.request.data,
            value: this.request.value,
            fee: this.request.fee,
            validityStartHeight: this.request.validityStartHeight,
            flags: this.request.flags,
        };

        staticStore.keyguardRequest = request;

        const client = this.$rpc.createKeyguardClient(true);
        client.signTransaction(request);
    }
}
</script>

<style scoped>
    .nq-h1 {
        margin-top: 3.5rem;
        margin-bottom: 1rem;
        line-height: 1;
        text-align: center;
    }

    .subline,
    .sync-status {
        text-align: center;
        padding-left: 2rem;
        padding-right: 2rem;
        margin: 1rem 0;
    }

    .sync-status {
        font-weight: 600;
        color: var(--nimiq-light-blue);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 1rem;
    }
</style>
