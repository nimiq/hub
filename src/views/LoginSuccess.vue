<template>
    <div class="container pad-bottom">
        <SmallPage>
            <Loader
                :title="title"
                :state="state"
                :status="status"
                :lightBlue="true"
                :mainAction="action"
                @main-action="resolveResult"
                :message="message" />
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
    private receiptsError: Error | null = null;
    private result: Account | null = null;

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
                    const { walletInfo, receiptsError } = await WalletInfoCollector.collectWalletInfo(
                        keyResult.keyType,
                        keyResult.keyId,
                        keyguardResultAccounts,
                    );

                    if (receiptsError) {
                        this.receiptsError = receiptsError;
                    }

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

    @Emit()
    private done() {
        if (!this.walletInfos.length) throw new Error('WalletInfo not ready.');
        this.result = {
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

        if (this.receiptsError) {
            this.title = 'Your addresses may be\nincomplete.';
            this.state = Loader.State.WARNING;
        } else {
            this.title = 'Your account is ready.';
            this.state = Loader.State.SUCCESS;
            setTimeout(this.resolveResult.bind(this), Loader.SUCCESS_REDIRECT_DELAY);
        }
    }

    private get status() {
        return !this.retrievalFailed ? 'Connecting to Nimiq...' : 'Address retrieval failed. Retrying...';
    }

    private get message() {
        return this.receiptsError && 'We might have missed used addresses that have no balance.';
    }

    private get action() {
        return this.receiptsError && 'Go to account';
    }

    private resolveResult() {
        if (!this.result) return;
        this.$rpc.resolve(this.result);
    }
}
</script>
