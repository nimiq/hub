<template>
    <div class="container">
        <PaymentInfoLine v-if="rpcState"
                         :amount="request.value"
                         :networkFee="request.fee"
                         :networkFeeEditable="false"
                         :origin="rpcState.origin"/>
        <SmallPage>
            <router-view @add-wallet="addWallet"/>
        </SmallPage>
        <button class="global-close nq-button-s" :class="{'hidden': $route.name === 'checkout-success'}" @click="close">
            <span class="nq-icon arrow-left"></span>
            Cancel Payment
        </button>
    </div>
</template>

<script lang="ts">
import { Component, Emit, Vue } from 'vue-property-decorator';
import { PaymentInfoLine, SmallPage } from '@nimiq/vue-components';
import { ParsedCheckoutRequest, RequestType } from '../lib/RequestTypes';
import { State as RpcState } from '@nimiq/rpc';
import staticStore, { Static } from '../lib/StaticStore';
import { LoginResult } from '@/lib/RequestTypes';
import { WalletStore } from '@/lib/WalletStore';
import { WalletInfo } from '../lib/WalletInfo';
import { Mutation } from 'vuex-class';

@Component({components: {PaymentInfoLine, SmallPage}})
export default class Checkout extends Vue {
    @Static private rpcState!: RpcState;
    @Static private request!: ParsedCheckoutRequest;

    @Mutation('addWallet') private $addWallet!: (walletInfo: WalletInfo) => any;
    @Mutation('setActiveAccount') private $setActiveAccount!: (payload: {
        walletId: string,
        userFriendlyAddress: string,
    }) => any;

    private addWallet() {
        // Redirect to import
        const request: KeyguardRequest.ImportRequest = {
            appName: this.request.appName,
            defaultKeyPath: `m/44'/242'/0'/0'`,
            requestedKeyPaths: [`m/44'/242'/0'/0'`],
        };

        staticStore.originalRequestType = RequestType.CHECKOUT;

        const client = this.$rpc.createKeyguardClient();
        client.import(request).catch(console.error); // TODO: proper error handling
    }

    private async created() {
        if (staticStore.sideResult && !(staticStore.sideResult instanceof Error)) {
            const sideResult = staticStore.sideResult as LoginResult;
            // Add imported wallet to store and pre-select wallet (if regular wallet)
            // or stay on first page for imported legacy wallet

            const walletInfo = await WalletStore.Instance.get(sideResult.walletId);
            if (!walletInfo) return;
            this.$addWallet(walletInfo);

            // Set as activeWallet and activeAccount
            this.$setActiveAccount({
                walletId: walletInfo.id,
                userFriendlyAddress: walletInfo.accounts.values().next().value.userFriendlyAddress,
            });
        }
        delete staticStore.sideResult;
    }

    @Emit()
    private close() {
        this.$rpc.reject(new Error('CANCEL'));
    }
}
</script>
