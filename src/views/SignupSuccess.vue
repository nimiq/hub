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
    ACCOUNT_DEFAULT_LABEL_LEDGER
} from '@/lib/Constants';

@Component({components: {SmallPage}})
export default class SignupSuccess extends Vue {
    @Prop({ default: null })
    public createResult!: KeyguardRequest.CreateResult;

    @State private keyguardResult?: KeyguardRequest.CreateResult;

    private title: string = 'Storing your wallet';
    private state: Loader.State = Loader.State.LOADING;

    private async mounted() {
        let walletType: WalletType;
        let walletLabel: string;
        let accountLabel: string;

        if (this.keyguardResult) {
            this.createResult = this.keyguardResult;
            walletType = WalletType.BIP39;
            walletLabel = WALLET_DEFAULT_LABEL_KEYGUARD;
            accountLabel = ACCOUNT_DEFAULT_LABEL_KEYGUARD;
        } else {
            if (!this.createResult) throw new Error('SignupSuccess shown without createResult');
            walletType = WalletType.LEDGER;
            walletLabel = WALLET_DEFAULT_LABEL_LEDGER;
            accountLabel = ACCOUNT_DEFAULT_LABEL_LEDGER;
        }

        const createdAddress = new Nimiq.Address(this.createResult.address);

        const accountInfo = new AccountInfo(
            this.createResult.keyPath,
            accountLabel,
            createdAddress!,
        );

        const walletInfo = new WalletInfo(
            this.createResult.keyId,
            walletLabel,
            new Map<string, AccountInfo>().set(accountInfo.userFriendlyAddress, accountInfo),
            [],
            walletType,
        );

        await WalletStore.Instance.put(walletInfo);

        // Artificially delay, to display loading status
        await new Promise((res) => setTimeout(res, 2000));

        this.state = Loader.State.SUCCESS;

        const result: OnboardingResult = {
            walletId: walletInfo.id,
            label: walletInfo.label,
            type: walletInfo.type,
            accounts: [{
                address: accountInfo.userFriendlyAddress,
                label: accountInfo.label,
            }],
        };

        setTimeout(() => this.$rpc.resolve(result), Loader.SUCCESS_REDIRECT_DELAY);
    }
}
</script>
