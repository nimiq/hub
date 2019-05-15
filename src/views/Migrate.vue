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

        <SmallPage v-else-if="page === 'accounts'" class="accounts">
            <PageHeader backArrow @back="page = 'intro'; backupsAreSafe = false;">
                Check your Backup{{legacyAccounts.length > 1 ? 's' : ''}}
                <p slot="more" class="nq-notice warning">
                    The update is easy, fast and secure. Still – it’s a good time to check on your Recovery Words.
                </p>
            </PageHeader>
            <PageBody>
                <div v-for="account in legacyAccounts" :key="account.userFriendlyAddress" class="account">
                    <Identicon :address="account.userFriendlyAddress"/>
                    <div class="meta">
                        <div class="label">{{account.label}}</div>
                        <Amount v-if="account.balance !== undefined" :amount="2037021e5" :decimals="0"/>
                    </div>
                    <button class="nq-button-s" @click="startBackup(account.userFriendlyAddress)">Back Up</button>
                </div>
            </PageBody>

            <PageFooter>
                <transition name="transition-fade" mode="out-in">
                    <div v-if="!backupsAreSafe" class="nq-light-blue-bg check-box">
                        <label>
                            <input type="checkbox" v-model="backupsAreSafe">
                            <div class="checkcircle"><CheckmarkIcon/></div>
                            My Backups are safe.
                        </label>
                    </div>
                    <button v-else class="nq-button light-blue activate" @click="runMigration">Activate update</button>
                </transition>
            </PageFooter>
        </SmallPage>

        <SmallPage v-else class="migration">
            <Loader
                lightBlue
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
import {
    SmallPage, PageHeader, PageBody, PageFooter,
    Identicon, Amount,
    ArrowRightIcon, CheckmarkIcon,
} from '@nimiq/vue-components';
import Network from '@/components/Network.vue';
import Loader from '@/components/Loader.vue';
import KeyguardClient from '@nimiq/keyguard-client';
import { ACCOUNT_DEFAULT_LABEL_LEGACY } from '@/lib/Constants';
import { ContractInfo } from '@/lib/ContractInfo';
import { Static } from '@/lib/StaticStore';
import { SimpleRequest } from '@/lib/PublicRequestTypes';

@Component({components: {
    SmallPage, PageHeader, PageBody, PageFooter,
    Identicon, Amount,
    ArrowRightIcon, CheckmarkIcon,
    Loader, Network,
}})
export default class Migrate extends Vue {
    @Static private request!: SimpleRequest;

    private page: 'intro' | 'accounts' | 'migration' = 'accounts';
    private backupsAreSafe: boolean = false;

    private title: string = 'Migrating your accounts';
    private status: string = 'Connecting to Keyguard...';
    private state: Loader.State = Loader.State.LOADING;
    private message: string = '';

    private legacyAccounts: AccountInfo[] = [];

    public async created() {
        const legacyKeys = await this.$rpc.keyguardClient.listLegacyAccounts();
        this.legacyAccounts = legacyKeys.map((key) => this.legacyKeyInfoObject2AccountInfo(key));
    }

    private startBackup(address: string) {
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
        this.page = 'migration';

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

    .accounts .page-body {
        margin-top: -2rem;
        padding-top: 4rem;
        mask-image: linear-gradient(0deg , rgba(255,255,255,0), rgba(255,255,255, 1) 4rem, rgba(255,255,255,1) calc(100% - 4rem), rgba(255,255,255,0));
    }

    .account {
        display: flex;
        flex-direction: row;
        justify-content: flex-start;
        align-items: center;
        margin: 4rem 0;
    }

    .account .identicon {
        width: 6.25rem;
        height: 6.25rem;
        margin-right: 2rem;
    }

    .account .meta {
        flex-grow: 1;
    }

    .account .label {
        font-size: 2.25rem;
        line-height: 2rem;
        font-weight: bold;
        margin-bottom: -.25rem;
    }

    .account .amount {
        font-size: 1.75rem;
        line-height: 2rem;
        font-weight: 600;
        opacity: .5;
    }

    .page-footer .nq-button {
        margin-top: 1rem;
        margin-bottom: 3rem;
        width: calc(100% - 10rem);
    }

    .check-box {
        width: 100%;
        padding: 2.5rem;
        border-radius: .5rem;
        font-size: 2.375rem;
        font-weight: 600;
        text-align: center;
        position: relative;
    }

    .check-box {
        transition: opacity .5s .5s ease-in;
    }

    .nq-button.activate {
        transition:
            transform 450ms cubic-bezier(.25,0,0,1),
            box-shadow 450ms cubic-bezier(.25,0,0,1),
            opacity 450ms cubic-bezier(.25,0,0,1);
    }

    .check-box input {
        position: absolute;
        left: -9999rem;
        opacity: 0;
    }

    .check-box label {
        display: inline-flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
        padding: 1.5rem 2.5rem;
        cursor: pointer;
        border-radius: 4rem;
    }

    .check-box .checkcircle {
        border: solid .25rem rgba(255, 255, 255, 0.6);
        border-radius: 50%;
        width: 3.5rem;
        height: 3.5rem;
        margin-right: 2rem;
        position: relative;
        flex-shrink: 0;
    }

    .check-box .checkcircle .nq-icon {
        display: none;
    }

    .check-box .checkcircle::after {
        content: "";
        position: absolute;
        left: -0.875rem;
        top: -0.875rem;
        right: -0.875rem;
        bottom: -0.875rem;
        border: 0.25rem solid rgba(255, 255, 255, 0.6);
        border-radius: 50%;
        opacity: 0;
    }

    .check-box input:focus ~ .checkcircle::after,
    .check-box input:active ~ .checkcircle::after {
        opacity: 1;
    }

    .check-box input:checked ~ .checkcircle {
        background: rgba(255, 255, 255, 0.6);
        border: none;
    }

    .check-box input:checked ~ .checkcircle::after {
        left: -0.625rem;
        top: -0.625rem;
        right: -0.625rem;
        bottom: -0.625rem;
    }

    .check-box input:checked ~ .checkcircle .nq-icon {
        position: absolute;
        display: block;
        font-size: 3rem;
        margin-left: -1.125rem;
        left: 50%;
        bottom: .75rem;
    }

    .transition-fade-enter,
    .transition-fade-leave-to {
        opacity: 0;
    }

    /*
    Because Vue does virtual-DOM diffing, pages are not replaced as complete components but rather
    parts of the pages are replaced, e.g. the footer content (while the footer element itself
    stays the same).

    This has a negative visual effect on the check-box, because it has a transition applied
    which fades it out when it is de-rendered. Because of the DOM-diffing instead of full element
    replacing, the check-box is rendered fading-out next to the intro page's "Prepare for update"
    button when clicking on the back arrow.

    These styles here prevent that from happening by force-hiding them.

    If you know a better method to force Vue to throw out an element instead of fading it out,
    please make yourself known.
    */
    .intro .check-box,
    .intro .activate {
        display: none;
        transition: none;
    }
</style>
