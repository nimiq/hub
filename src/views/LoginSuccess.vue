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
                :alternativeAction="$t('Continue to Wallet')"
                @alternative-action="skip"
                :message="message" />
            <div v-if="canSkip" class="skip-box">
                <button @click="skip" class="skip nq-button-s inverse">{{ $t('Skip') }}</button>
            </div>
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
import { Account, RequestType } from '../../client/PublicRequestTypes';
import { WalletInfo } from '../lib/WalletInfo';
import { WalletStore } from '../lib/WalletStore';
import { Static } from '../lib/StaticStore';
import StatusScreen from '../components/StatusScreen.vue';
import WalletInfoCollector, { BasicAccountInfo } from '../lib/WalletInfoCollector';
import { WalletCollectionResultKeyguard } from '../lib/WalletInfoCollector';
import CookieHelper from '../lib/CookieHelper';
import { ERROR_COOKIE_SPACE, WalletType } from '../lib/Constants';
import { PolygonAddressInfo } from '../lib/polygon/PolygonAddressInfo';
import { NetworkClient } from '../lib/NetworkClient';

@Component({components: {StatusScreen, SmallPage}})
export default class LoginSuccess extends Vue {
    @Static private request!: ParsedBasicRequest;
    @State private keyguardResult!: KeyguardClient.KeyResult;

    @Action('addWalletAndSetActive') private $addWalletAndSetActive!: (walletInfo: WalletInfo) => any;

    private walletInfos: WalletInfo[] = [];
    private state: StatusScreen.State = StatusScreen.State.LOADING;
    private title: string = this.$root.$t('Fetching your Addresses') as string;
    private status: string = this.$root.$t('Connecting...') as string;
    private message: string = '';
    private action: string = '';
    private receiptsError: Error | null = null;
    private result: Account[] | null = null;
    private canSkip = true;

    private resolve = (...args: any[]) => {}; // tslint:disable-line:no-empty

    private async mounted() {
        const collectionResults: WalletCollectionResultKeyguard[] = [];

        // Add retry mechanism for network initialization
        let networkInitTryCount = 0;
        while (true) {
            try {
                networkInitTryCount += 1;
                await NetworkClient.Instance.init();
                break;
            } catch (e) {
                if (networkInitTryCount >= 3) throw e;
                console.error('Network initialization failed, retrying...', e);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retrying
            }
        }

        // Initialize consensus check promise before using it
        const consensusEstablishedPromise = new Promise<void>((resolve, reject) => {
            let consensusCheckCount = 0;
            let isResolved = false;

            // Set up consensus change listener first
            NetworkClient.Instance.innerClient.then((client) => {
                client.addConsensusChangedListener((state) => {
                    if (state === 'syncing') {
                        this.status = this.$root.$t('Syncing to network...').toString();
                    } else if (state === 'established') {
                        this.status = this.$root.$t('Detecting addresses...').toString();
                        if (!isResolved) {
                            isResolved = true;
                            resolve();
                        }
                    }
                });
            });

            const checkConsensus = async () => {
                try {
                    const client = await NetworkClient.Instance.innerClient;
                    consensusCheckCount += 1;

                    if (await client.isConsensusEstablished()) {
                        if (!isResolved) {
                            isResolved = true;
                            resolve();
                        }
                    } else if (consensusCheckCount >= 12) { // Increased from 3 to 12 attempts
                        reject(new Error('Failed to establish consensus after several attempts. Please check your internet connection and try again.'));
                    } else {
                        // Exponential backoff: wait longer between each retry
                        const timeout = Math.min(15000, 5000 * Math.pow(1.5, consensusCheckCount - 1));
                        setTimeout(checkConsensus, timeout);
                    }
                } catch (e) {
                    if (consensusCheckCount >= 12) {
                        reject(e);
                    } else {
                        const timeout = Math.min(15000, 5000 * Math.pow(1.5, consensusCheckCount - 1));
                        setTimeout(checkConsensus, timeout);
                    }
                }
            };

            // Start checking consensus
            checkConsensus();
        });

        try {
            // Wait for consensus to be established before proceeding
            await consensusEstablishedPromise;

            await Promise.all(
                this.keyguardResult.map(async (keyResult) => {
                    // The Keyguard always returns (at least) one derived Address,
                    const keyguardResultAccounts = keyResult.addresses.map((addressObj, index) => ({
                        address: new Nimiq.Address(addressObj.address).toUserFriendlyAddress(),
                        path: addressObj.keyPath,
                        index,
                    }));

                    let tryCount = 0;
                    while (true) {
                        try {
                            tryCount += 1;
                            let collectionResult: WalletCollectionResultKeyguard;
                            if (keyResult.keyType === WalletType.BIP39 as number) {
                                collectionResult = await WalletInfoCollector.collectBip39WalletInfo(
                                    keyResult.keyId,
                                    keyguardResultAccounts,
                                    this.onUpdate.bind(this),
                                    this.keyguardResult.length === 1,
                                    keyResult.bitcoinXPub,
                                    keyResult.tmpCookieEncryptionKey,
                                );

                                // Because we only use one Polygon address for now, we are not including it in the
                                // address detection above.
                                collectionResult.walletInfo.polygonAddresses = keyResult.polygonAddresses
                                    ? [new PolygonAddressInfo(
                                        keyResult.polygonAddresses[0].keyPath,
                                        keyResult.polygonAddresses[0].address,
                                    )]
                                    : [];
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

                            if (keyResult.keyLabel) {
                                collectionResult.walletInfo.label = keyResult.keyLabel;
                            }

                            collectionResults.push(collectionResult);

                            break;
                        } catch (e) {
                            this.status = this.$root.$t('Address detection failed. Retrying...').toString();
                            if (tryCount >= 12) throw new Error('Failed to detect addresses after several attempts. Please check your internet connection and try again.');
                            console.error('Address detection failed, retrying...', e);
                            // Exponential backoff for retries
                            const timeout = Math.min(15000, 2000 * Math.pow(1.5, tryCount - 1));
                            await new Promise(resolve => setTimeout(resolve, timeout));
                        }
                    }
                }),
            );
        } catch (e) {
            this.canSkip = false;
            this.state = StatusScreen.State.ERROR;
            this.title = this.$t('Fetching Addresses Failed') as string;
            this.message = this.$t('Syncing with the network failed: {error}', { error: e.message || e }) as string;
            this.action = this.$t('Retry') as string;
            await new Promise((resolve) => { this.resolve = resolve; });
            window.location.reload();
            return;
        }

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
            const walletInfosToKeep = collectionResults
                .filter((collectionResult) => keepWalletCondition(collectionResult))
                .map((collectionResult) => collectionResult.walletInfo.toObject());
            failBecauseOfCookieSpace = !await CookieHelper.canFitNewWallets(walletInfosToKeep);
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
            this.title = this.$t('Space exceeded') as string;
            this.state = StatusScreen.State.ERROR;
            this.message = this.$t('Unfortunately, due to space restrictions of Safari and IOS, this account cannot be '
                + 'stored properly. Please free up space by logging out of other accounts.') as string;
            this.action = this.$t('Continue') as string;
            await new Promise((resolve) => { this.resolve = resolve; });
            this.$rpc.reject(new Error(ERROR_COOKIE_SPACE));
            return;
        }

        this.done();
    }

    private onUpdate(walletInfo: WalletInfo, currentlyCheckedAccounts: BasicAccountInfo[]) {
        const count = !walletInfo ? 0 : walletInfo.accounts.size;
        this.canSkip = count > 0;
        if (count <= 1) return;
        this.status = this.$tc('Imported {count} address so far... | Imported {count} addresses so far...', count);
    }

    private async done() {
        if (!this.walletInfos.length) throw new Error('WalletInfo not ready.');

        this.canSkip = false;

        // Add wallets to vuex
        for (const walletInfo of this.walletInfos) {
            this.$addWalletAndSetActive(walletInfo);
        }

        const result: Account[] = await Promise.all(
            this.walletInfos.map((walletInfo) => walletInfo.toAccountType(RequestType.LOGIN)),
        );

        if (this.receiptsError) {
            this.title = this.$t('Your Addresses may be\nincomplete.') as string;
            this.state = StatusScreen.State.WARNING;
            this.message = this.$t('Used addresses without balance might have been missed.') as string;
            this.action = this.$t('Continue') as string;
            await new Promise((resolve) => { this.resolve = resolve; });
        }

        // In RequestType.CHANGE_PASSWORD a reset password function was added leading to an import with
        // recovery words. Display an appropriate success message in case that is how this successful
        // import came to be.
        if (this.request.kind === RequestType.CHANGE_PASSWORD) {
            this.title = this.$t('Your password was changed.') as string;
            this.state = StatusScreen.State.SUCCESS;
            setTimeout(() => { this.$rpc.resolve({success: true}); }, StatusScreen.SUCCESS_REDIRECT_DELAY);
            return;
        }

        this.title = this.$tc('Welcome back! | Your Accounts are ready.', result.length);
        this.state = StatusScreen.State.SUCCESS;
        setTimeout(() => { this.$rpc.resolve(result); }, StatusScreen.SUCCESS_REDIRECT_DELAY);
    }

    private async skip() {
        this.canSkip = false;
        this.title = this.$t('Welcome back!') as string;
        this.state = StatusScreen.State.SUCCESS;
        const result: Account[] = await Promise.all(
            this.walletInfos.map((walletInfo) => walletInfo.toAccountType(RequestType.LOGIN)),
        );
        setTimeout(() => { this.$rpc.resolve(result); }, StatusScreen.SUCCESS_REDIRECT_DELAY);
    }
}
</script>

<style scoped>
.small-page {
    position: relative;
}

.status-screen {
    z-index: unset;
}

.skip-box {
    position: absolute;
    bottom: 2rem;
    left: 0;
    width: 100%;
    text-align: center;
}
</style>
