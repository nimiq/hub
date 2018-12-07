<template>
    <div class="container pad-bottom">
        <SmallPage>
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
import { SmallPage } from '@nimiq/vue-components';
import Loader from '@/components/Loader.vue';
import { KeyguardClient } from '@nimiq/keyguard-client';

@Component({components: {SmallPage, Loader}})
export default class Migrate extends Vue {
    private title: string = 'Migrating your accounts';
    private status: string = 'Connecting to Keyguard...';
    private state: Loader.State = Loader.State.LOADING;
    private message: string = '';

    private static: {keyguardClient?: KeyguardClient} = {};

    public mounted() {
        this.static.keyguardClient = this.$rpc.createKeyguardClient();
        Object.freeze(this.static);
        this.run();
    }

    private async run() {
        try {
            await this.doMigration();
        } catch (error) {
            this.onError(error);
        }
    }

    private async doMigration() {
        const hasLegacyAccounts = await this.static.keyguardClient!.hasLegacyAccounts();

        if (!hasLegacyAccounts) {
            this.title = 'Nothing to migrate.';
            this.state = Loader.State.SUCCESS;
            setTimeout(() => this.$rpc.resolve([]), Loader.SUCCESS_REDIRECT_DELAY);
            return;
        }

        this.status = 'Retrieving your legacy accounts...';
        const legacyAccounts = await this.static.keyguardClient!.listLegacyAccounts();

        if (!legacyAccounts) {
            throw new Error('Could not get legacy accounts from Keyguard');
        }

        this.status = 'Storing your new wallets...';
        const walletInfos = legacyAccounts.map((account) => {
            const address = new Nimiq.Address(account.legacyAccount!.address);
            const accounts = new Map<string, AccountInfo>([
                [address.toUserFriendlyAddress(), new AccountInfo('m/0\'', account.legacyAccount!.label, address)],
            ]);

            return new WalletInfo(
                account.id,
                'Legacy Wallet',
                accounts,
                [], // Contracts
                WalletType.LEGACY,
            );
        });

        const storagePromises = walletInfos.map((walletInfo) => WalletStore.Instance.put(walletInfo));
        await Promise.all(storagePromises);

        this.status = 'Migrating Keyguard...';
        await this.static.keyguardClient!.migrateAccountsToKeys();

        this.title = 'Migration completed.';
        this.state = Loader.State.SUCCESS;
        const walletInfoEntries = walletInfos.map((walletInfo) => walletInfo.toObject());
        setTimeout(() => this.$rpc.resolve(walletInfoEntries), Loader.SUCCESS_REDIRECT_DELAY);
    }

    private onError(error: Error) {
        this.title = 'Ups, something went wrong';
        this.message = `${error.name}: ${error.message}`;
        this.state = Loader.State.ERROR;
        throw error; // Notify sentry
    }

    private tryAgain() {
        this.title = 'Migrating your accounts';
        this.status = 'Connecting to Keyguard...';
        this.state = Loader.State.LOADING;
        setTimeout(() => this.run(), 1000);
    }
}
</script>

<style scoped>
    .small-page {
        height: 70rem;
    }
</style>
