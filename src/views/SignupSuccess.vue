<template>
    <div class="container pad-bottom">
        <SmallPage>
            <Loader :title="title" :state="state" :lightBlue="true">
                <template slot="success">
                    <div class="success nq-icon"></div>
                    <h1 class="title nq-h1">Welcome to the<br>Nimiq Blockchain.</h1>
                </template>
            </Loader>
        </SmallPage>
    </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';
import { SmallPage } from '@nimiq/vue-components';
import { AccountInfo } from '../lib/AccountInfo';
import { WalletInfo, WalletType } from '../lib/WalletInfo';
import { State } from 'vuex-class';
import { WalletStore } from '@/lib/WalletStore';
import { OnboardingResult } from '@/lib/RequestTypes';
import Loader from '@/components/Loader.vue';
import {
    WALLET_DEFAULT_LABEL_KEYGUARD,
    WALLET_DEFAULT_LABEL_LEDGER,
    ACCOUNT_DEFAULT_LABEL_KEYGUARD,
    ACCOUNT_DEFAULT_LABEL_LEDGER,
} from '@/lib/Constants';
import KeyguardClient from '@nimiq/keyguard-client';

@Component({components: {SmallPage, Loader}})
export default class SignupSuccess extends Vue {
    @State private keyguardResult!: KeyguardClient.KeyResult;

    private title: string = 'Storing your wallet';
    private state: Loader.State = Loader.State.LOADING;

    private async mounted() {
        const walletType = WalletType.BIP39;
        const walletLabel = WALLET_DEFAULT_LABEL_KEYGUARD;
        const accountLabel = ACCOUNT_DEFAULT_LABEL_KEYGUARD;

        const createdAddress = new Nimiq.Address(this.keyguardResult[0].addresses[0].address);

        const accountInfo = new AccountInfo(
            this.keyguardResult[0].addresses[0].keyPath,
            accountLabel,
            createdAddress!,
        );

        const walletInfo = new WalletInfo(
            this.keyguardResult[0].keyId,
            walletLabel,
            new Map<string, AccountInfo>().set(accountInfo.userFriendlyAddress, accountInfo),
            [],
            walletType,
            false, // keyMissing
            this.keyguardResult[0].fileExported,
            this.keyguardResult[0].wordsExported,
        );

        await WalletStore.Instance.put(walletInfo);

        // Artificially delay, to display loading status
        await new Promise((res) => setTimeout(res, 2000));

        this.state = Loader.State.SUCCESS;

        const result: OnboardingResult = {
            walletId: walletInfo.id,
            label: walletInfo.label,
            type: walletInfo.type,
            fileExported: walletInfo.fileExported,
            wordsExported: walletInfo.wordsExported,
            accounts: [{
                address: accountInfo.userFriendlyAddress,
                label: accountInfo.label,
            }],
        };

        setTimeout(() => this.$rpc.resolve(result), Loader.SUCCESS_REDIRECT_DELAY);
    }
}
</script>
