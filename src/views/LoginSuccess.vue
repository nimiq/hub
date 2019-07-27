<template>
    <div class="container pad-bottom">
        <SmallPage>
            <StatusScreen
                :title="title"
                :state="state"
                :status="status"
                :lightBlue="true"
                :mainAction="action"
                @main-action="resolve"
                :message="message" />
        </SmallPage>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { State, Action } from 'vuex-class';
import KeyguardClient from '@nimiq/keyguard-client';
import { BrowserDetection } from '@nimiq/utils';
import { SmallPage } from '@nimiq/vue-components';
import { ParsedBasicRequest } from '../lib/RequestTypes';
import { Account } from '../lib/PublicRequestTypes';
import { WalletInfo, WalletType } from '../lib/WalletInfo';
import { WalletStore } from '../lib/WalletStore';
import { Static } from '../lib/StaticStore';
import StatusScreen from '../components/StatusScreen.vue';
import WalletInfoCollector, { BasicAccountInfo } from '../lib/WalletInfoCollector';
import { WalletCollectionResultKeyguard } from '../lib/WalletInfoCollector';
import CookieHelper from '../lib/CookieHelper';
import { ERROR_COOKIE_SPACE } from '../lib/Constants';

@Component({components: {StatusScreen, SmallPage}})
export default class LoginSuccess extends Vue {
    @Static private request!: ParsedBasicRequest;
    @State private keyguardResult!: KeyguardClient.KeyResult;

    @Action('addWalletAndSetActive') private $addWalletAndSetActive!: (walletInfo: WalletInfo) => any;

    private walletInfos: WalletInfo[] = [];
    private state: StatusScreen.State = StatusScreen.State.LOADING;
    private title: string = 'Fetching your addresses';
    private status: string = 'Connecting to network...';
    private message: string = '';
    private action: string = '';
    private receiptsError: Error | null = null;
    private result: Account[] | null = null;
    private resolve = () => {}; // tslint:disable-line:no-empty

    private async mounted() {
        const collectionResults: WalletCollectionResultKeyguard[] = [];

        await Promise.all(
            this.keyguardResult.map(async (keyResult) => {
                // The Keyguard always returns (at least) one derived Address,
                const keyguardResultAccounts = keyResult.addresses.map((addressObj) => ({
                    address: new Nimiq.Address(addressObj.address).toUserFriendlyAddress(),
                    path: addressObj.keyPath,
                }));

                let tryCount = 0;
                while (true) {
                    try {
                        tryCount += 1;
                        let collectionResult: WalletCollectionResultKeyguard;
                        if (keyResult.keyType === WalletType.BIP39) {
                            collectionResult = await WalletInfoCollector.collectBip39WalletInfo(
                                keyResult.keyId,
                                keyguardResultAccounts,
                                this.onUpdate.bind(this),
                                this.keyguardResult.length === 1,
                            );
                        } else {
                            collectionResult = await WalletInfoCollector.collectLegacyWalletInfo(
                                keyResult.keyId,
                                keyguardResultAccounts[0],
                                this.onUpdate.bind(this),
                                this.keyguardResult.length === 1,
                            );
                        }

                        if (collectionResult.receiptsError) {
                            this.receiptsError = collectionResult.receiptsError;
                        }

                        collectionResult.walletInfo.fileExported = collectionResult.walletInfo.fileExported
                            || keyResult.fileExported;
                        collectionResult.walletInfo.wordsExported = collectionResult.walletInfo.wordsExported
                            || keyResult.wordsExported;

                        collectionResults.push(collectionResult);

                        break;
                    } catch (e) {
                        this.status = 'Address detection failed. Retrying...';
                        if (tryCount >= 5) throw e;
                    }
                }
            }),
        );

        // In case there is only one returned Account it is always added.
        let keepWalletCondition: (collectionResult: WalletCollectionResultKeyguard) => boolean = () => true;
        if (collectionResults.length > 1) {
            if (collectionResults.some((walletInfo) => walletInfo.hasActivity)) {
                // In case there is more than one account returned and at least one saw activity in the past
                // add the accounts with activity while discarding the others.
                keepWalletCondition = (collectionResult) => collectionResult.hasActivity;
            } else {
                // In case of more than one returned account but none saw activity in the past
                // look for the BIP39 account and add it while discarding the others.
                keepWalletCondition = (collectionResult) => collectionResult.walletInfo.type === WalletType.BIP39;
            }
        }

        let failBecauseOfCookieSpace = false;
        if (BrowserDetection.isIOS() || BrowserDetection.isSafari()) {
            const infoEntries = this.walletInfos.map((walletInfo) => walletInfo.toObject());
            if (!await CookieHelper.canFitNewWallets(infoEntries)) {
                failBecauseOfCookieSpace = true;
            }
        }

        await Promise.all (
            collectionResults.map(async (collectionResult) => {
                if (!failBecauseOfCookieSpace && keepWalletCondition(collectionResult)) {
                    await WalletStore.Instance.put(collectionResult.walletInfo);
                    this.walletInfos.push(collectionResult.walletInfo);
                    await collectionResult.releaseKey(false);
                } else {
                    await collectionResult.releaseKey(true);
                }
            }),
        );

        if (failBecauseOfCookieSpace) {
            this.title = 'Space exceeded';
            this.state = StatusScreen.State.ERROR;
            this.message = 'Unfortunately, due to space restrictions of Safari and IOS, this account cannot '
                         + 'be stored properly. Please free up space by logging out of other accounts.';
            this.action = 'Continue';
            await new Promise((resolve) => { this.resolve = resolve; });
            this.$rpc.reject(new Error(ERROR_COOKIE_SPACE));
            return;
        }

        this.done();
    }

    private onUpdate(walletInfo: WalletInfo, currentlyCheckedAccounts: BasicAccountInfo[]) {
        const count = !walletInfo ? 0 : walletInfo.accounts.size;
        this.status = `Imported ${count} address${count !== 1 ? 'es' : ''} so far...`;
    }

    private async done() {
        if (!this.walletInfos.length) throw new Error('WalletInfo not ready.');

        // Add wallets to vuex
        for (const walletInfo of this.walletInfos) {
            this.$addWalletAndSetActive(walletInfo);
        }

        const result = this.walletInfos.map((walletInfo) => ({
                accountId: walletInfo.id,
                label: walletInfo.label,
                type: walletInfo.type,
                fileExported: walletInfo.fileExported,
                wordsExported: walletInfo.wordsExported,
                addresses: Array.from(walletInfo.accounts.values())
                    .map((addressInfo) => addressInfo.toAddressType()),
                contracts: walletInfo.contracts.map((contract) => contract.toContractType()),
        }));

        if (this.receiptsError) {
            this.title = 'Your Addresses may be\nincomplete.';
            this.state = StatusScreen.State.WARNING;
            this.message = 'Used addresses without balance might have been missed.';
            this.action = 'Continue';
            await new Promise((resolve) => { this.resolve = resolve; });
        }

        if (result.length > 1) {
            this.title = 'Your Accounts are ready.';
        } else {
            this.title = 'Your Account is ready.';
        }
        this.state = StatusScreen.State.SUCCESS;
        setTimeout(() => { this.$rpc.resolve(result); }, StatusScreen.SUCCESS_REDIRECT_DELAY);
    }
}
</script>
