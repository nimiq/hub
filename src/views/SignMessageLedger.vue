<template>
    <div class="container">
        <SmallPage>
            <PageHeader>
                {{ $t('Sign Message') }}
            </PageHeader>

            <PageBody>
                <textarea class="message" readonly="readonly" :value="request.message"></textarea>

                <div v-if="signerInfo" class="account">
                    <div class="identicon" id="signer-identicon">
                        <Identicon :address="signerInfo.userFriendlyAddress"></Identicon>
                    </div>
                    <div class="account-text">
                        <div class="label" id="signer-label">{{ signerInfo.label }}</div>
                        <span class="label-right">{{ $t('Signer') }}</span>
                    </div>
                </div>
            </PageBody>

            <div class="bottom-container" :class="{ 'full-height': state !== constructor.State.OVERVIEW }">
                <LedgerUi small></LedgerUi>
                <transition name="transition-fade">
                    <StatusScreen v-if="state !== constructor.State.OVERVIEW"
                        state="success"
                        :title="$t('Your message is signed.')"
                    />
                </transition>
            </div>
        </SmallPage>

        <GlobalClose :hidden="state !== constructor.State.OVERVIEW" />
    </div>
</template>

<script lang="ts">
import Config from 'config';
import { Component, Vue } from 'vue-property-decorator';
import { Getter } from 'vuex-class';
import LedgerApi from '@nimiq/ledger-api';
import { SmallPage, PageHeader, PageBody, Identicon } from '@nimiq/vue-components';
import LedgerUi from '../components/LedgerUi.vue';
import StatusScreen from '../components/StatusScreen.vue';
import GlobalClose from '../components/GlobalClose.vue';
import { RequestType } from '../../client/PublicRequestTypes';
import { ParsedSignMessageRequest } from '../lib/RequestTypes';
import { Static } from '../lib/StaticStore';
import { WalletInfo } from '../lib/WalletInfo';
import { AccountInfo } from '../lib/AccountInfo';

@Component({ components: { SmallPage, PageHeader, PageBody, Identicon, LedgerUi, StatusScreen, GlobalClose } })
export default class SignMessageLedger extends Vue {
    private static readonly State = {
        OVERVIEW: 'overview',
        FINISHED: 'finished',
    };

    @Static protected request!: ParsedSignMessageRequest;

    @Getter private findWalletByAddress!: (address: string, includeContracts: boolean) => WalletInfo | undefined;
    @Getter private activeWallet: WalletInfo | undefined;
    @Getter private activeAccount: AccountInfo | undefined;

    private state: string = SignMessageLedger.State.OVERVIEW;
    private signerInfo: AccountInfo | null = null;

    private async created() {
        let walletInfo: WalletInfo | undefined;
        let accountInfo: AccountInfo | undefined;

        if (this.request.signer) {
            // It's a request which specifies an address for a Ledger account, for which the RpcApi redirected to
            // SignMessageLedger. The address should be known to the Hub given by the fact that RpcApi detected it as
            // a Ledger address.
            const signerAddress = this.request.signer.toUserFriendlyAddress();
            walletInfo = this.findWalletByAddress(signerAddress, false);
            accountInfo = walletInfo?.accounts.get(signerAddress);
        } else {
            // It's a request which does not specify a signer address. Instead, the user selected an address in
            // SignMessage, which set the address as active address and redirected to SignMessageLedger.
            walletInfo = this.activeWallet;
            accountInfo = this.activeAccount;
        }
        if (!walletInfo || !accountInfo) {
            // This case should not happen, as either the RpcApi redirected here because it knows that the address is a
            // Ledger address, or SignMessage redirected here after the user selected one of the addresses known to the
            // Hub. Note that both, the request and active address, also survive reloads.
            // Let the user choose an address.
            this.$router.replace({ name: RequestType.SIGN_MESSAGE });
            return;
        }
        this.signerInfo = accountInfo;

        try {
            const { signer, signature } = await LedgerApi.Nimiq.signMessage(
                this.request.message,
                accountInfo.path,
                undefined,
                walletInfo.keyId,
                Config.ledgerApiNimiqVersion,
            );

            const result = {
                signer: signer.toAddress().toUserFriendlyAddress(),
                signerPublicKey: signer.serialize(),
                signature: signature.serialize(),
            };

            this.state = SignMessageLedger.State.FINISHED;
            await new Promise((resolve) => setTimeout(resolve, StatusScreen.SUCCESS_REDIRECT_DELAY));
            this.$rpc.resolve(result);
        } catch (e) {
            this.$rpc.reject(e);
        }
    }
}
</script>

<style scoped>
.small-page {
    position: relative;
    padding-bottom: 23rem; /* bottom padding for bottom-container */
}

.page-body {
    display: flex;
    flex-direction: column;
    padding: 0 1rem 0;
}

.message {
    width: 100%;
    padding: 1.5rem;
    flex-grow: 1;
    font-size: 1.75rem;
    line-height: 1.2;
    font-family: 'Fira Mono', monospace;
    color: rgba(31, 35, 72, .7); /* Based on Nimiq Blue */
    background-color: rgba(31, 35, 72, .05); /* Based on Nimiq Blue */
    border: solid 1px rgba(31, 35, 72, .1); /* Based on Nimiq Blue */
    border-radius: 0.5rem;
    outline: none;
    resize: none;
}

.account {
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 2.75rem 2rem 1.75rem;
}

.account .identicon {
    width: 5.625rem;
    height: 5.625rem;
    margin-right: 2rem;
    flex-shrink: 0;
}

.account-text {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    flex-grow: 1;
    font-size: 2rem;
    max-width: calc(100% - 5.625rem - 2rem); /* .identicon width and margin-right */
}

.account .label {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.account .label-right {
    opacity: 0.7;
    margin-left: 2rem;
}

.bottom-container {
    position: absolute;
    width: 100%;
    height: 23rem;
    bottom: 0;
    transition: height .4s;
}

.bottom-container.full-height {
    height: 100%;
}

.bottom-container > * {
    position: absolute;
    top: 0;
}

.status-screen {
    transition: opacity .4s;
}
</style>
