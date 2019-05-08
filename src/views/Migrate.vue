<template>
    <div class="container pad-bottom">
        <SmallPage v-if="!isMigrating">
            <div class="page-header nq-card-header">
                <h1 class="nq-h1">We've updated!</h1>
                <p class="nq-notice info">
                    The new Nimiq Keyguard requires a database update.
                </p>
                <p class="nq-text">
                    To refresh your backups before we update,<br>select an account below.
                </p>
            </div>


            <AccountList
                walletId="unused"
                :accounts="legacyAccounts"
                @account-selected="accountSelected"/>

            <PageFooter>
                <button class="nq-button" @click="runMigration">Ok, update database</button>
            </PageFooter>
        </SmallPage>

        <SmallPage v-else>
            <Loader
                :title="title"
                :status="status"
                :state="state"
                :message="message"
                mainAction="Try again"
                @main-action="tryAgain"
            />
            <Network ref="network" :visible="false"/>
        </SmallPage>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { AccountInfo } from '@/lib/AccountInfo';
import { WalletStore } from '@/lib/WalletStore';
import { WalletInfo, WalletType } from '@/lib/WalletInfo';
import { SmallPage, PageHeader, PageBody, PageFooter, AccountList } from '@nimiq/vue-components';
import Network from '@/components/Network.vue';
import Loader from '@/components/Loader.vue';
import KeyguardClient from '@nimiq/keyguard-client';
import { ACCOUNT_DEFAULT_LABEL_LEGACY } from '@/lib/Constants';
import { ContractInfo } from '@/lib/ContractInfo';
import { Static } from '@/lib/StaticStore';
import { SimpleRequest } from '@/lib/PublicRequestTypes';

@Component({components: {SmallPage, PageHeader, PageBody, PageFooter, AccountList, Loader, Network}})
export default class Migrate extends Vue {
    @Static private request!: SimpleRequest;

    private title: string = 'Migrating your accounts';
    private status: string = 'Connecting to Keyguard...';
    private state: Loader.State = Loader.State.LOADING;
    private message: string = '';

    private legacyAccounts: AccountInfo[] = [];
    private isMigrating: boolean = false;

    public async created() {
        const legacyKeys = await this.$rpc.keyguardClient.listLegacyAccounts();
        this.legacyAccounts = legacyKeys.map((key) => this.legacyKeyInfoObject2AccountInfo(key));
    }

    private accountSelected(walletId: string, address: string) {
        // Start export request for this address
        const request: KeyguardClient.ExportRequest = {
            appName: this.request.appName,
            keyId: address,
            keyLabel: '',
        };

        const client = this.$rpc.createKeyguardClient();
        client.export(request);
    }

    private async runMigration() {
        try {
            await this.doMigration();
        } catch (error) {
            this.onError(error);
        }
    }

    private async doMigration() {
        this.isMigrating = true;

        this.status = 'Retrieving your legacy accounts...';
        const legacyAccounts = await this.$rpc.keyguardClient.listLegacyAccounts();

        if (!legacyAccounts.length) {
            throw new Error('Could not get legacy accounts from Keyguard');
        }

        this.status = 'Detecting vesting contracts...';
        const genesisVestingContracts = await (this.$refs.network as Network).getGenesisVestingContracts();
        (this.$refs.network as Network).disconnect(); // Prevent syncing consensus

        this.status = 'Storing your new accounts...';
        // For the wallet ID derivation to work, the ID derivation and storing of new wallets needs
        // to happen serially, e.g. synchroneous.
        const walletInfos: WalletInfo[] = [];
        for (const account of legacyAccounts) {
            const address = new Nimiq.Address(account.legacyAccount.address);
            const accounts = new Map<string, AccountInfo>([
                [address.toUserFriendlyAddress(), new AccountInfo('m/0\'', account.legacyAccount.label, address)],
            ]);

            const contracts = genesisVestingContracts.filter((contract) => contract.owner.equals(address));

            const walletInfo = new WalletInfo(
                await WalletStore.deriveId(account.id),
                account.id,
                ACCOUNT_DEFAULT_LABEL_LEGACY,
                accounts,
                contracts,
                WalletType.LEGACY,
            );

            await WalletStore.Instance.put(walletInfo);

            walletInfos.push(walletInfo);
        }

        this.status = 'Migrating Keyguard...';
        await this.$rpc.keyguardClient.migrateAccountsToKeys();

        this.title = 'Migration completed.';
        this.state = Loader.State.SUCCESS;
        const listResult = walletInfos.map((walletInfo) => walletInfo.toAccountType());
        setTimeout(() => this.$rpc.resolve(listResult), Loader.SUCCESS_REDIRECT_DELAY);
    }

    private onError(error: Error) {
        this.title = 'Whoops, something went wrong';
        this.message = `${error.name}: ${error.message}`;
        this.state = Loader.State.ERROR;
        if (window.location.origin === 'https://hub.nimiq-testnet.com') {
            this.$raven.captureException(error);
        }
    }

    private tryAgain() {
        this.title = 'Migrating your accounts';
        this.status = 'Connecting to Keyguard...';
        this.state = Loader.State.LOADING;
        setTimeout(() => this.runMigration(), 1000);
    }

    private legacyKeyInfoObject2AccountInfo(keyInfo: KeyguardClient.LegacyKeyInfoObject): AccountInfo {
        return new AccountInfo(
            'm/0\'',
            keyInfo.legacyAccount.label,
            new Nimiq.Address(keyInfo.legacyAccount.address),
        );
    }
}
</script>

<style>
    .page-header {
        padding-bottom: 0;
    }
</style>
