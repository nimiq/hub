<template>
    <div class="container pad-bottom">
        <Network ref="network" :visible="false"/>
        <SmallPage v-if="page === 'intro'" class="intro">
            <PageHeader>
                Time to grow
                <p slot="more" class="nq-notice info">
                    Nimiq just got better! New UX and UI come with a batch of new features.
                </p>
            </PageHeader>

            <PageBody>
                <div class="topic">
                    <div class="topic-visual account-ring"></div>
                    <p class="topic-copy">
                        One Account can now have multiple Addresses.
                    </p>
                </div>
                <div class="topic">
                    <p class="topic-copy">
                        Nimiq implements the ImageWallet standard with the Nimiq Login File.
                    </p>
                    <div class="topic-visual login-file"></div>
                </div>
                <div class="topic">
                    <div class="topic-visual qr-code"></div>
                    <p class="topic-copy">
                        Create and scan QR codes to quickly share Addresses.
                    </p>
                </div>

                <a href="https://medium.com/nimiq-network" target="_blank" class="nq-link link-read-article">
                    ...and much more. Read the full article <ArrowRightIcon/>
                </a>
            </PageBody>

            <PageFooter>
                <button class="nq-button light-blue" @click="page = 'accounts'">Prepare for update</button>
            </PageFooter>
        </SmallPage>

        <SmallPage v-else-if="page === 'accounts'">
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
        </SmallPage>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { AccountInfo } from '@/lib/AccountInfo';
import { WalletStore } from '@/lib/WalletStore';
import { WalletInfo, WalletType } from '@/lib/WalletInfo';
import { SmallPage, PageHeader, PageBody, PageFooter, AccountList, ArrowRightIcon } from '@nimiq/vue-components';
import Network from '@/components/Network.vue';
import Loader from '@/components/Loader.vue';
import KeyguardClient from '@nimiq/keyguard-client';
import { ACCOUNT_DEFAULT_LABEL_LEGACY } from '@/lib/Constants';
import { ContractInfo } from '@/lib/ContractInfo';
import { Static } from '@/lib/StaticStore';
import { SimpleRequest } from '@/lib/PublicRequestTypes';

@Component({components: {SmallPage, PageHeader, PageBody, PageFooter, AccountList, ArrowRightIcon, Loader, Network}})
export default class Migrate extends Vue {
    @Static private request!: SimpleRequest;

    private page: 'intro' | 'accounts' | 'migration' = 'intro';

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
    .intro .page-body {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding-left: 5rem;
        padding-right: 5rem;
    }

    .topic {
        display: flex;
        flex-direction: row;
        align-items: center;
    }

    .topic-visual {
        flex-shrink: 0;
        width: 8rem;
        height: 8rem;
        border-radius: .5rem;
        background: rgba(0, 0, 0, 0.05);
        margin-top: -1rem;
        margin-bottom: -1rem;
        margin-right: 3rem;
    }

    .topic-copy {
        margin: 0;
        font-size: 2rem;
        line-height: 1.3;
    }

    .topic-copy + .topic-visual {
        margin-right: 0;
        margin-left: 3rem;
    }

    .topic-visual.login-file {
        width: 6.875rem;
        height: 11.75rem;
        margin-top: -2.875rem;
        margin-bottom: -2.875rem;
    }

    .link-read-article {
        font-size: 2rem;
        font-weight: bold;
        align-self: center;
    }

    .link-read-article .nq-icon {
        vertical-align: middle;
        width: 1.375rem;
        height: 1.125rem;
        margin-top: -0.125rem;
        transition: transform .3s cubic-bezier(0.25, 0, 0, 1);
    }

    .link-read-article:hover .nq-icon,
    .link-read-article:focus .nq-icon {
        transform: translate3D(0.25rem, 0, 0);
    }

    .page-footer .nq-button {
        margin-top: 1rem;
        margin-bottom: 3rem;
        width: calc(100% - 10rem);
    }
</style>
