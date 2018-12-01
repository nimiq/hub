<template>
    <div class="container pad-bottom">
        {{ status }}
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { AccountInfo } from '@/lib/AccountInfo';
import { WalletStore } from '@/lib/WalletStore';
import { WalletInfo, WalletType } from '@/lib/WalletInfo';

@Component
export default class Migrate extends Vue {
    private status: string = 'Connecting to Keyguard...';
    private waitUntilReturn: number = 1000;

    public async mounted() {
        const client = this.$rpc.createKeyguardClient();
        const hasLegacyKeys = await client.hasKeys(true).catch(console.error); // TODO: proper error handling

        if (!hasLegacyKeys) {
            this.status = 'Nothing to migrate.';
            setTimeout(() => this.$rpc.resolve([]), this.waitUntilReturn);
            return;
        }

        this.status = 'Retrieving your legacy accounts...';
        const legacyKeys = await client.list(true).catch(console.error); // TODO: proper error handling
        if (!legacyKeys) {
            this.status = 'Could not get legacy accounts.';
            this.$rpc.reject(new Error('Cannot get legacy keys from Keyguard'));
            return;
        }

        this.status = 'Converting your legacy accounts...';
        const walletInfos = legacyKeys.map((key) => {
            const address = new Nimiq.Address(key.legacyAccount!.address);
            const accounts = new Map<string, AccountInfo>([
                [address.toUserFriendlyAddress(), new AccountInfo('m/0\'', key.legacyAccount!.label, address)],
            ]);

            return new WalletInfo(
                key.id,
                'Legacy Wallet',
                accounts,
                [], // Contracts
                WalletType.LEGACY,
            );
        });

        this.status = 'Storing your new wallets...';
        const storagePromises = walletInfos.map((walletInfo) => WalletStore.Instance.put(walletInfo));
        await Promise.all(storagePromises);

        this.status = 'Migrating Keyguard...';
        await client.migrateAccountsToKeys();

        this.status = 'Done.';
        const walletInfoEntries = walletInfos.map((walletInfo) => walletInfo.toObject());
        setTimeout(() => this.$rpc.resolve(walletInfoEntries), this.waitUntilReturn);
    }
}
</script>
