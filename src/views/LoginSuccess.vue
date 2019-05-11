<template>
    <div class="container pad-bottom">
        <SmallPage>
            <Loader
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
import { State } from 'vuex-class';
import KeyguardClient from '@nimiq/keyguard-client';
import { BrowserDetection } from '@nimiq/utils';
import { SmallPage } from '@nimiq/vue-components';
import { ParsedBasicRequest } from '../lib/RequestTypes';
import { Account } from '../lib/PublicRequestTypes';
import { WalletInfo, WalletType } from '../lib/WalletInfo';
import { WalletStore } from '@/lib/WalletStore';
import { Static } from '@/lib/StaticStore';
import Loader from '@/components/Loader.vue';
import CookieHelper from '../lib/CookieHelper';
import WalletInfoCollector, { WalletCollectionResult } from '../lib/WalletInfoCollector';
import { ERROR_COOKIE_SPACE } from '../lib/Constants';

@Component({components: {Loader, SmallPage}})
export default class LoginSuccess extends Vue {
    @Static private request!: ParsedBasicRequest;
    @State private keyguardResult!: KeyguardClient.KeyResult;

    private walletInfos: WalletInfo[] = [];
    private retrievalFailed: boolean = false;
    private state: Loader.State = Loader.State.LOADING;
    private title: string = 'Collecting your addresses';
    private message: string = '';
    private action: string = '';
    private receiptsError: Error | null = null;
    private result: Account[] | null = null;
    private resolve = () => {}; // tslint:disable-line:no-empty

    private async mounted() {
        const collectionResults: WalletCollectionResult[] = [];

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
                        const collectionResult = await WalletInfoCollector.collectWalletInfo(
                            keyResult.keyType,
                            keyResult.keyId,
                            keyguardResultAccounts,
                            undefined,
                            this.keyguardResult.length > 1,
                        );

                        if (collectionResult.receiptsError) {
                            this.receiptsError = collectionResult.receiptsError;
                        }

                        collectionResult.walletInfo.fileExported = collectionResult.walletInfo.fileExported
                            || keyResult.fileExported;
                        collectionResult.walletInfo.wordsExported = collectionResult.walletInfo.wordsExported
                            || keyResult.wordsExported;

                        collectionResults.push(collectionResult);

                        this.retrievalFailed = false;
                        break;
                    } catch (e) {
                        this.retrievalFailed = true;
                        if (tryCount >= 5) throw e;
                    }
                }
            }),
        );

        // In case there is only one returned Account it is always added.
        let keepWalletCondition: (collectionResult: WalletCollectionResult) => boolean = (collectionResult) => true;
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

        await Promise.all (
            collectionResults.map( async (collectionResult) => {
                if (keepWalletCondition(collectionResult)) {
                    await WalletStore.Instance.put(collectionResult.walletInfo);
                    this.walletInfos.push(collectionResult.walletInfo);
                    await collectionResult.releaseKey(false);
                } else {
                    await collectionResult.releaseKey(true);
                }
            }),
        );

        this.done();
    }

    private async done() {
        if (!this.walletInfos.length) throw new Error('WalletInfo not ready.');

        if (BrowserDetection.isIOS() || BrowserDetection.isSafari()) {
            const infoEntries = this.walletInfos.map((walletInfo) => walletInfo.toObject());
            if (!await CookieHelper.canFitNewWallets(infoEntries)) {
                this.title = 'Space exceeded';
                this.state = Loader.State.WARNING;
                this.message = 'Unfortunately, due to space restrictions of Safari and IOS, this account cannot '
                             + 'be stored properly. Please free up space by logging out of other accounts.';
                this.action = 'Continue';
                await new Promise((resolve) => { this.resolve = resolve; });
                this.$rpc.reject(new Error(ERROR_COOKIE_SPACE));
                return;
            }
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
            this.title = 'Your addresses may be\nincomplete.';
            this.state = Loader.State.WARNING;
            this.message = 'We might have missed used addresses that have no balance.';
            this.action = 'Continue';
            await new Promise((resolve) => { this.resolve = resolve; });
        }

        this.title = 'Your account is ready.';
        this.state = Loader.State.SUCCESS;
        setTimeout(() => { this.$rpc.resolve(result); }, Loader.SUCCESS_REDIRECT_DELAY);
    }

    private get status() {
        return !this.retrievalFailed ? 'Connecting to Nimiq...' : 'Address retrieval failed. Retrying...';
    }
}
</script>
