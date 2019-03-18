<template>
    <div class="container pad-bottom">
        <SmallPage>
            <Loader :title="title" :state="state" :lightBlue="true">
                <template slot="success">
                    <div class="success nq-icon"></div>
                    <h1 class="title nq-h1">Awesome!<br>Your new address has<br/>been added to your account.</h1>
                </template>
            </Loader>
        </SmallPage>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { SmallPage } from '@nimiq/vue-components';
import { AccountInfo } from '../lib/AccountInfo';
import { State } from 'vuex-class';
import { WalletStore } from '../lib/WalletStore';
import { DeriveAddressResult } from '@nimiq/keyguard-client';
import { ParsedSimpleRequest } from '../lib/RequestTypes';
import { Address } from '../lib/PublicRequestTypes';
import Loader from '@/components/Loader.vue';
import { Static } from '../lib/StaticStore';
import { ADDRESS_DEFAULT_LABEL_KEYGUARD } from '../lib/Constants';

@Component({components: {Loader, SmallPage}})
export default class AddAccountSuccess extends Vue {
    @Static private request!: ParsedSimpleRequest;
    @State private keyguardResult!: DeriveAddressResult;

    private walletLabel: string = '';
    private state: Loader.State = Loader.State.LOADING;
    private title: string = 'Storing your address';
    private accountLabel: string = ADDRESS_DEFAULT_LABEL_KEYGUARD;
    private createdAddress: Nimiq.Address | null = null;

    private async mounted() {
        this.createdAddress = new Nimiq.Address(this.keyguardResult.address);

        const wallet = await WalletStore.Instance.get(this.request.walletId);
        if (!wallet) throw new Error('Account ID not found');

        this.walletLabel = wallet.label;

        const newAccount = new AccountInfo(
            this.keyguardResult.keyPath,
            this.accountLabel,
            this.createdAddress!,
        );

        wallet.accounts.set(this.createdAddress!.toUserFriendlyAddress(), newAccount);

        await WalletStore.Instance.put(wallet);
        // Artificially delay, to display loading status
        await new Promise((res) => setTimeout(res, 2000));

        this.state = Loader.State.SUCCESS;

        const result: Address = {
            address: this.createdAddress!.toUserFriendlyAddress(),
            label: this.accountLabel,
        };

        setTimeout(() => this.$rpc.resolve(result), Loader.SUCCESS_REDIRECT_DELAY);
    }
}
</script>

<style scoped>
    .page-body {
        padding: 1rem 0 4rem 0;
    }

    .success-box {
        padding: 5rem 4rem;
        overflow: auto;
        margin: 0 1rem;
        border-radius: 0.5rem;
        background-position: calc(100% - 2rem) center;
        background-size: auto 15.125rem;
        display: block;
        width: unset;
        height: unset;
    }

    .success-box p {
        width: 25rem;
        opacity: 1;
    }

    .success-box p + p {
        width: 20rem;
    }

    .login-label {
        display: flex;
        flex-direction: row;
        justify-content: flex-start;
        align-items: center;
        font-size: 2.25rem;
        line-height: 2.5rem;
        font-weight: 500;
        margin: 2rem 3rem 0;
        padding: 2rem 1rem;
        border-bottom: solid 1px var(--nimiq-card-border-color);
    }

    .login-icon {
        height: 3rem;
        width: 3rem;
        flex-shrink: 0;
        margin-right: 1rem;
    }
</style>
