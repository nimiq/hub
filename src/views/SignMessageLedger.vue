<template>
    <div class="container">
        <SmallPage id="sign-message">
            <PageHeader>
                {{ $t('Sign Message') }}
            </PageHeader>

            <PageBody>
                <textarea id="message" readonly="readonly" :value="request.message"></textarea>

                <div class="account">
                    <div class="identicon" id="signer-identicon">
                        <Identicon :address="activeAccount.userFriendlyAddress"></Identicon>
                    </div>
                    <div class="account-text">
                        <div class="label" id="signer-label">{{ activeAccount.defaultLabel }}</div>
                        <span class="label-right">{{ $t('Signer') }}</span>
                    </div>
                </div>

                <div class="bottom-container">
                    <LedgerUi small></LedgerUi>
                </div>
            </PageBody>
        </SmallPage>

        <GlobalClose />
    </div>
</template>

<script lang="ts">
import Config from 'config';
import { Component, Vue } from 'vue-property-decorator';
import { Getter } from 'vuex-class';
import { SmallPage, PageBody, PageHeader, Identicon } from '@nimiq/vue-components';
import GlobalClose from '../components/GlobalClose.vue';
import LedgerUi from '../components/LedgerUi.vue';
import { ParsedSignMessageRequest } from '../lib/RequestTypes';
import { Static } from '../lib/StaticStore';
import { WalletInfo } from '@/lib/WalletInfo';
import { AccountInfo } from '@/lib/AccountInfo';
import LedgerApi from '@nimiq/ledger-api';

@Component({ components: { SmallPage, GlobalClose, LedgerUi, PageBody, PageHeader, Identicon } })
export default class SignMessageLedger extends Vue {
    @Static protected request!: ParsedSignMessageRequest;

    @Getter private activeWallet!: WalletInfo | undefined;
    @Getter private activeAccount!: AccountInfo | undefined;

    private async created() {
        const walletInfo = this.activeWallet;
        const accountInfo = this.activeAccount;

        try {
            const signedMessage = await LedgerApi.Nimiq.signMessage(
                this.request.message,
                accountInfo!.path,
                undefined,
                walletInfo!.keyId,
                Config.ledgerApiNimiqVersion,
            );

            const result = {
                signer: signedMessage.signer.toAddress().toUserFriendlyAddress(),
                signerPublicKey: signedMessage.signer.serialize(),
                signature: signedMessage.signature.serialize(),
            };

            this.$rpc.resolve(result);
        } catch (e) {
            this.$rpc.reject(e);
        }
    }
}
</script>

<style scoped>
.small-page#sign-message .page-body {
    display: flex;
    flex-direction: column;
    padding-left: 1rem;
    padding-right: 1rem;
    padding-bottom: 0;
}

.account {
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 3rem 2rem;
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
    max-width: calc(100% - 5.625rem - 2rem);
    /* .identicon width and margin-right */
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

#message {
    font-size: 1.75rem;
    line-height: 1.2;
    color: rgba(31, 35, 72, .7);
    /* Based on Nimiq Blue */
    background-color: rgba(31, 35, 72, .05);
    /* Based on Nimiq Blue */
    border: solid 1px rgba(31, 35, 72, .1);
    /* Based on Nimiq Blue */
    border-radius: 0.5rem;
    outline: none;
    width: 100%;
    padding: 1.5rem;
    flex-grow: 1;
    resize: none;
    font-family: 'Fira Mono', monospace;
}

.bottom-container {
    height: 23rem;
}
</style>
