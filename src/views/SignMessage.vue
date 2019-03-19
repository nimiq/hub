<template>
    <div v-if="showAccountSelector" class="container">
        <SmallPage>
            <div class="info-line">
                <span class="request-title">Sign Message</span>
                <div class="arrow-runway">
                    <i class="nq-icon arrow-right"></i>
                </div>
                <span class="origin">{{ originDomain }}</span>
            </div>

            <h1 class="nq-h1">Choose an account to sign</h1>

            <AccountSelector
                :wallets="processedWallets"
                @account-selected="setAccount"
                @login="goToOnboarding"/>
        </SmallPage>

        <button class="global-close nq-button-s" @click="close">
            <span class="nq-icon arrow-left"></span>
            Back to {{request.appName}}
        </button>
    </div>
</template>

<script lang="ts">
import { Component, Emit, Vue } from 'vue-property-decorator';
import { Getter, Mutation } from 'vuex-class';
import { SmallPage, AccountSelector } from '@nimiq/vue-components';
import { RequestType, ParsedSignMessageRequest } from '../lib/RequestTypes';
import { Account } from '../lib/PublicRequestTypes';
import staticStore, { Static } from '../lib/StaticStore';
import { WalletStore } from '@/lib/WalletStore';
import { AccountInfo } from '@/lib/AccountInfo';
import { WalletInfo } from '@/lib/WalletInfo';
import KeyguardClient from '@nimiq/keyguard-client';
import { Utf8Tools } from '@nimiq/utils';
import { ERROR_CANCELED } from '@/lib/Constants';
import { State as RpcState } from '@nimiq/rpc';

@Component({components: {SmallPage, AccountSelector}})
export default class SignMessage extends Vue {
    @Static protected request!: ParsedSignMessageRequest;
    @Static private rpcState!: RpcState;

    @Getter private processedWallets!: WalletInfo[];
    @Getter private findWallet!: (id: string) => WalletInfo | undefined;

    @Mutation('addWallet') private $addWallet!: (walletInfo: WalletInfo) => any;
    @Mutation('setActiveAccount') private $setActiveAccount!: (payload: {
        walletId: string,
        userFriendlyAddress: string,
    }) => any;

    private showAccountSelector = false;

    private async created() {
        await this.handleOnboardingResult();

        if (this.request.walletId && this.request.signer) {
            this.setAccount(this.request.walletId, this.request.signer.toUserFriendlyAddress(), true);
            return;
        }

        this.showAccountSelector = true;
    }

    private async setAccount(walletId: string, address: string, isFromRequest = false) {
        const walletInfo = this.findWallet(walletId);
        if (!walletInfo) {
            // We can also return an error here and when checking the address below,
            // but it would enable malicous sites to query for stored walletIds and addresses.
            // Instead we quietly ignore any unavailable pre-set walletId and address and give
            // the user the option to chose as if it was not pre-set.
            this.showAccountSelector = true;
            if (!isFromRequest) throw new Error(`UNEXPECTED: Selected walletId was not found: ${walletId}`);
            return;
        }

        const accountInfo = walletInfo.accounts.get(address);
        if (!accountInfo) {
            this.showAccountSelector = true;
            if (!isFromRequest) throw new Error(`UNEXPECTED: Selected account was not found: ${address}`);
            return;
        }

        // Forward to Keyguard
        const request: KeyguardClient.SignMessageRequest = {
            appName: this.request.appName,

            keyId: walletInfo.id,
            keyPath: accountInfo.path,

            message: this.messageBytes(),

            signer: accountInfo.address.serialize(),
            signerLabel: accountInfo.label,
        };

        const storedRequest = Object.assign({}, request, {
            signer: Array.from(request.signer),
            message: Array.from(request.message as Uint8Array),
        });
        staticStore.keyguardRequest = storedRequest;

        const client = this.$rpc.createKeyguardClient();
        client.signMessage(request);
    }

    private messageBytes(): Uint8Array {
        if (typeof this.request.message === 'string') {
            return Utf8Tools.stringToUtf8ByteArray(this.request.message);
        }
        return new Uint8Array(this.request.message);
    }

    private goToOnboarding(useReplace?: boolean) {
        // Redirect to onboarding
        staticStore.originalRouteName = RequestType.SIGN_MESSAGE;
        if (useReplace) {
            this.$rpc.routerReplace(RequestType.ONBOARD);
        } else {
            this.$rpc.routerPush(RequestType.ONBOARD);
        }
    }

    private async handleOnboardingResult() {
        // Check if we are returning from an onboarding request
        if (staticStore.sideResult && !(staticStore.sideResult instanceof Error)) {
            const sideResult = staticStore.sideResult as Account;

            // Add imported wallet to Vuex store
            const walletInfo = await WalletStore.Instance.get(sideResult.accountId);
            if (walletInfo) {
                this.$addWallet(walletInfo);

                // Set as activeWallet and activeAccount
                // FIXME: Currently unused, but should be reactivated
                const activeAccount = walletInfo.accounts.values().next().value;

                this.$setActiveAccount({
                    walletId: walletInfo.id,
                    userFriendlyAddress: activeAccount.userFriendlyAddress,
                });
            }
        }
        delete staticStore.sideResult;
    }

    @Emit()
    private close() {
        this.$rpc.reject(new Error(ERROR_CANCELED));
    }

    private get originDomain() {
        return this.rpcState.origin.split('://')[1];
    }
}
</script>

<style scoped>
    .info-line {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        box-sizing: border-box;
        margin: 2.5rem 2.5rem 1rem 2.5rem;
        flex-shrink: 0;
        font-size: 2rem;
        line-height: 1.5;
        font-weight: normal;
    }

    .request-title {
        font-weight: bold;
        color: var(--nimiq-light-blue);
    }

    .arrow-runway {
        flex-grow: 1;
        text-align: right;
        display: flex;
        flex-direction: row;
        align-items: center;
        overflow: hidden;
    }

    .arrow-right {
        opacity: 0;
        width: 100%;
        background-size: calc(2 * var(--nimiq-size, 8px));
        background-position: left center;
        /* animation: arrow-shooting 2s ease-in-out infinite; */
        opacity: 0.3;
        background-position: center;
    }

    @keyframes arrow-shooting {
        from { transform: translateX(calc(20% - var(--nimiq-size, 8px))); }
        10% { opacity: 0; }
        50% { opacity: 0.3; }
        90% { opacity: 0; }
        to { transform: translateX(calc(80% - var(--nimiq-size, 8px))); }
    }

    .nq-h1 {
        margin-top: 3.5rem;
        margin-bottom: 1rem;
        line-height: 1;
        text-align: center;
    }
</style>
