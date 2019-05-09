<template>
    <div class="container pad-bottom">
        <SmallPage>
            <Loader :title="title" :state="state" :lightBlue="true">
                <template slot="success">
                    <CheckmarkIcon/>
                    <h1 class="title nq-h1">New address added<br>to your account.</h1>
                </template>
            </Loader>
        </SmallPage>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { SmallPage, CheckmarkIcon } from '@nimiq/vue-components';
import { AccountInfo } from '../lib/AccountInfo';
import { State } from 'vuex-class';
import { WalletStore } from '../lib/WalletStore';
import { DeriveAddressResult } from '@nimiq/keyguard-client';
import { ParsedSimpleRequest } from '../lib/RequestTypes';
import { Address } from '../lib/PublicRequestTypes';
import Loader from '@/components/Loader.vue';
import { Static } from '../lib/StaticStore';
import LabelingMachine from '@/lib/LabelingMachine';

@Component({components: {Loader, SmallPage, CheckmarkIcon}})
export default class AddAccountSuccess extends Vue {
    @Static private request!: ParsedSimpleRequest;
    @State private keyguardResult!: DeriveAddressResult;

    private state: Loader.State = Loader.State.LOADING;
    private title: string = 'Storing your address';

    private async mounted() {
        const createdAddress = new Nimiq.Address(this.keyguardResult.address);

        const wallet = (await WalletStore.Instance.get(this.request.walletId))!;

        const newAccount = new AccountInfo(
            this.keyguardResult.keyPath,
            LabelingMachine.labelAddress(createdAddress.toUserFriendlyAddress()),
            createdAddress,
        );

        wallet.accounts.set(newAccount.userFriendlyAddress, newAccount);

        await WalletStore.Instance.put(wallet);
        // Artificially delay, to display loading status
        await new Promise((res) => setTimeout(res, 2000));

        this.state = Loader.State.SUCCESS;

        const result: Address = {
            address: newAccount.userFriendlyAddress,
            label: newAccount.label,
        };

        setTimeout(() => this.$rpc.resolve(result), Loader.SUCCESS_REDIRECT_DELAY);
    }
}
</script>
