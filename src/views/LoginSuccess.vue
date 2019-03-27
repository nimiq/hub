<template>
    <div class="container pad-bottom">
        <SmallPage>
            <Loader :title="title" :state="state" :status="status" :lightBlue="true"/>
        </SmallPage>
    </div>
</template>

<script lang="ts">
import { Component, Emit, Vue } from 'vue-property-decorator';
import { ParsedBasicRequest, RequestType } from '../lib/RequestTypes';
import { Account } from '../lib/PublicRequestTypes';
import { State } from 'vuex-class';
import { WalletInfo, WalletType } from '../lib/WalletInfo';
import { WalletStore } from '@/lib/WalletStore';
import { Static } from '@/lib/StaticStore';
import { SmallPage } from '@nimiq/vue-components';
import Loader from '@/components/Loader.vue';
import WalletInfoCollector from '@/lib/WalletInfoCollector';
import Input from '@/components/Input.vue';
import KeyguardClient from '@nimiq/keyguard-client';

@Component({components: {Loader, SmallPage}})
export default class LoginSuccess extends Vue {
    @Static private request!: ParsedBasicRequest;
    @State private keyguardResult!: KeyguardClient.KeyResult;

    private walletInfos: WalletInfo[] = [];
    private retrievalFailed: boolean = false;
    private state: Loader.State = Loader.State.LOADING;
    private title: string = 'Collecting your addresses';
    private gotError: boolean = false;

    private async mounted() {
        // TODO: Handle import of both a legacy and bip39 key!
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
                    const walletInfo = await WalletInfoCollector.collectWalletInfo(
                        keyResult.keyType,
                        keyResult.keyId,
                        keyguardResultAccounts,
                        undefined,
                        this._onCollectAddressesError.bind(this),
                    );

                    walletInfo.fileExported = walletInfo.fileExported || keyResult.fileExported;
                    walletInfo.wordsExported = walletInfo.wordsExported || keyResult.wordsExported;

                    await WalletStore.Instance.put(walletInfo);
                    this.walletInfos.push(walletInfo);

                    this.retrievalFailed = false;
                    this.done();
                    break;
                } catch (e) {
                    this.retrievalFailed = true;
                    if (tryCount >= 5) throw e;
                }
            }
        });
    }

    private _onCollectAddressesError(error: Error) {
        this.gotError = true;
        // FIXME this.$raven is undefined
        // this.$raven.captureException(error);
    }

    @Emit()
    private done() {
        if (!this.walletInfos.length) throw new Error('WalletInfo not ready.');
        const result: Account = {
            accountId: this.walletInfos[0].id,
            label: this.walletInfos[0].label,
            type: this.walletInfos[0].type,
            fileExported: this.walletInfos[0].fileExported,
            wordsExported: this.walletInfos[0].wordsExported,
            addresses: Array.from(this.walletInfos[0].accounts.values()).map((addressInfo) => ({
                address: addressInfo.userFriendlyAddress,
                label: addressInfo.label,
            })),
        };

        if (this.gotError) {
            this.state = Loader.State.WARNING;
            this.title = `Your addresses may be
incomplete.`;
        } else {
            this.title = 'Your account is ready.';
            this.state = Loader.State.SUCCESS;
        }

        setTimeout(() => this.$rpc.resolve(result), Loader.SUCCESS_REDIRECT_DELAY);
    }

    private get status() {
        return !this.retrievalFailed ? 'Connecting to Nimiq...' : 'Address retrieval failed. Retrying...';
    }
}
</script>
