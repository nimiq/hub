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
import { Component, Vue } from 'vue-property-decorator';
import { SmallPage } from '@nimiq/vue-components';
import { AccountInfo } from '../lib/AccountInfo';
import { WalletInfo, WalletType } from '../lib/WalletInfo';
import { State } from 'vuex-class';
import { WalletStore } from '../lib/WalletStore';
import { OnboardingResult } from '@/lib/RequestTypes';
import Loader from '@/components/Loader.vue';
import { DEFAULT_LABEL_KEYGUARD_ACCOUNT, DEFAULT_LABEL_KEYGUARD_WALLET } from '@/lib/Constants';

@Component({components: {Loader, SmallPage}})
export default class SignupSuccess extends Vue {
    @State private keyguardResult!: KeyguardRequest.CreateResult;

    private title: string = 'Storing your account';
    private state: Loader.State = Loader.State.LOADING;

    private async mounted() {
        const accountInfo = new AccountInfo(
            this.keyguardResult.keyPath,
            DEFAULT_LABEL_KEYGUARD_ACCOUNT,
            new Nimiq.Address(this.keyguardResult.address),
        );

        const walletInfo = new WalletInfo(
            this.keyguardResult.keyId,
            DEFAULT_LABEL_KEYGUARD_WALLET,
            new Map<string, AccountInfo>().set(accountInfo.userFriendlyAddress, accountInfo),
            [],
            WalletType.BIP39,
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

<style scoped>
    .small-page {
        height: 70rem;
    }
</style>
