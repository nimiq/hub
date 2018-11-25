<template>
    <div>
        <PageHeader>Sign Message</PageHeader>
        <PageBody>
            <p class="nq-text">You are signing the following message:</p>
        </PageBody>

        <textarea readonly="readonly" v-model="requestMessage"></textarea>

        <div class="signer-section">
            <div class="signer-nav">
                <span class="nq-label">Sign with</span>
                <button class="nq-button-s" @click="changeAccount">Change</button>
            </div>
            <Account v-if="activeAccount" :address="activeAccount.userFriendlyAddress" :label="activeAccount.label" :balance="activeAccount.balance"/>
        </div>
        <PageFooter>
            <button @click="proceed" class="nq-button">Continue</button>
        </PageFooter>
    </div>
</template>

<script lang="ts">
import { Component, Emit } from 'vue-property-decorator';
import { Getter } from 'vuex-class';
import { Amount, Account, PageHeader, PageBody, PageFooter } from '@nimiq/vue-components';
import { ResponseStatus } from '@nimiq/rpc';
import { AccountInfo } from '../lib/AccountInfo';
import { WalletInfo } from '../lib/WalletInfo';
import { RequestType } from '../lib/RequestTypes';
import Utf8Tools from '../lib/Utf8Tools';
import SignMessage from '@/views/SignMessage.vue';

@Component({components: {Amount, Account, PageHeader, PageBody, PageFooter}})
export default class SignMessageOverview extends SignMessage {
    @Getter private activeWallet!: WalletInfo | undefined;
    @Getter private activeAccount!: AccountInfo | undefined;

    private get requestMessage(): string {
        if (typeof this.request.message === 'string') return this.request.message;
        if (Utf8Tools.isValidUtf8(this.request.message)) {
            return Utf8Tools.utf8ByteArrayToString(this.request.message);
        }
        return Nimiq.BufferUtils.toHex(this.request.message);
    }

    @Emit()
    private changeAccount() {
        this.$router.push({name: `${RequestType.SIGN_MESSAGE}-change-account`});
    }

    @Emit()
    private proceed() {
        const walletInfo = this.activeWallet;
        if (!walletInfo) {
            return; // TODO: Display error
        }

        const accountInfo = this.activeAccount;
        if (!accountInfo) {
            // TODO: Add contract support
            return;
        }

        this.sendKeyguardRequest(walletInfo, accountInfo);
    }
}
</script>

<style scoped>
    textarea {
        font-size: 2rem;
        line-height: 1.3;
        opacity: 0.7;
        padding: 2rem 4rem;
        border: none;
        border-top: solid 1px var(--nimiq-card-border-color);
        border-bottom: solid 1px var(--nimiq-card-border-color);
        outline: none;
        width: 100%;
        height: 20rem;
        resize: none;
    }

    @media (max-width: 450px) {
        textarea {
            padding: 2rem 3rem;
        }
    }

    .signer-section {
        padding-bottom: 2rem;
    }

    .signer-nav {
        padding: 2rem 2rem 1rem 2rem;
        display: flex;
        flex-direction: row;
        justify-content: space-between;
    }

    .signer-nav .nq-label {
        margin: 1rem;
    }

    .page-footer {
        padding: 1rem;
    }
</style>
