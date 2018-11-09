<template>
    <div>
        <PageHeader :progressIndicator="true" :numberSteps="6" :step="6">Your wallet is ready</PageHeader>
        <div class="page-body">
            <div class="success-box">
                <h2>Awesome!</h2>
                <p>Your Keyguard Wallet is set up. It already contains your newly created account.</p>
                <p>You can add more accounts to it later.</p>
            </div>

            <div class="login-label">
                <div class="login-icon" :class="walletIconClass"></div>
                <LabelInput :value="walletLabel" @changed="onWalletLabelChange"/>
            </div>

            <Account :address="createdAddress.toUserFriendlyAddress()" :label="accountLabel" :editable="true" @changed="onAccountLabelChange"/>

            <button class="submit" @click="done()">Open your wallet</button>
        </div>
    </div>
</template>

<script lang="ts">
import {Component, Vue} from 'vue-property-decorator';
import {PageHeader, Account, LabelInput} from '@nimiq/vue-components';
import {AddressInfo} from '../lib/AddressInfo';
import {KeyInfo, KeyStorageType} from '../lib/KeyInfo';
import {State, Getter} from 'vuex-class';
import {KeyStore} from '../lib/KeyStore';
import {CreateResult} from '@nimiq/keyguard-client';
import {ResponseStatus, State as RpcState} from '@nimiq/rpc';
import { SignupResult } from '@/lib/RequestTypes';
import {Static} from '../lib/StaticStore';

@Component({components: {PageHeader, Account, LabelInput}})
export default class SignupSuccess extends Vue {
    @Static private rpcState!: RpcState;
    @State private keyguardResult!: CreateResult;
    @State private activeAccountPath!: string;
    @Getter private hasWallets!: boolean;

    private walletLabel: string = 'Keyguard Wallet';
    private accountLabel: string = 'Standard Account';
    private createdAddress: Nimiq.Address | null = null;

    private get walletIconClass(): string {
        return 'keyguard';
    }

    private created() {
        this.createdAddress = new Nimiq.Address(this.keyguardResult.address);
        this.saveResult(this.walletLabel, this.accountLabel);
    }

    private onWalletLabelChange(label: string) {
        console.log(label);
        this.walletLabel = label;
        this.saveResult(this.walletLabel, this.accountLabel);
    }

    private onAccountLabelChange(label: string) {
        console.log(label);
        this.accountLabel = label;
        this.saveResult(this.walletLabel, this.accountLabel);
    }

    private async done() {
        const result: SignupResult = {
            keyId: this.keyguardResult.keyId,
            label: this.walletLabel,
            type: KeyStorageType.BIP39, // FIXME: Adapt when adding Ledger
            address: {
                address: this.createdAddress!.toUserFriendlyAddress(),
                label: this.accountLabel,
            },
        };

        this.rpcState.reply(ResponseStatus.OK, result);
    }

    private async saveResult(walletLabel: string, accountLabel: string) {
        const addressInfo = new AddressInfo(
            this.keyguardResult.keyPath,
            accountLabel,
            this.createdAddress!,
        );

        const keyInfo = new KeyInfo(
            this.keyguardResult.keyId,
            walletLabel,
            new Map<string, AddressInfo>().set(addressInfo.userFriendlyAddress, addressInfo),
            [],
            KeyStorageType.BIP39,
        );

        await KeyStore.Instance.put(keyInfo);
    }
}
</script>

<style scoped>
    .page-header {
        border-bottom: none;
    }

    .success-box {
        overflow: auto;
        margin: 0 1rem;
        color: white;
        border-radius: 0.5rem;
        background: #24bdb6;
        background-position: calc(100% - 2rem) center;
        background-size: auto 21.125rem;
        background-repeat: no-repeat;
        background-image: url('data:image/svg+xml,<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 169 169" style="enable-background:new 0 0 169 169;" xml:space="preserve" opacity="0.08"><path d="M50.73,59.45c-1.54,1.55-2.44,3.55-3.03,5.73l-0.07-0.04L1.36,152.08c-2.39,4.49-1.58,9.94,2.01,13.54 c2.22,2.22,5.13,3.38,8.09,3.38c1.84,0,3.7-0.44,5.41-1.37l86.58-46.31c2.26-0.6,4.24-1.62,5.78-3.17 c8.46-8.48,2.26-27.51-14.41-44.24C78.85,57.89,58.94,51.21,50.73,59.45 M104.26,113.16c-1.12,1.12-2.84,1.69-5.13,1.69 c-7.84,0-19.23-6.34-29.01-16.15C55.82,84.36,51.05,69.14,55.7,64.45c1.13-1.13,2.84-1.7,5.13-1.7c7.84,0,19.23,6.34,29.01,16.14 C104.14,93.26,108.92,108.48,104.26,113.16"/><path d="M167.98,83.01c-14.86-14.78-39.07-14.78-53.96,0c-1.36,1.35-1.36,3.56,0,4.91c0.68,0.68,1.58,1.02,2.47,1.02 c0.89,0,1.79-0.34,2.47-1.02c12.16-12.07,31.94-12.07,44.08,0c1.36,1.35,3.58,1.35,4.94,0S169.34,84.36,167.98,83.01"/><path d="M79.69,54.88c0.66,0.68,1.53,1.02,2.39,1.02c0.86,0,1.72-0.33,2.38-1.02c6.97-7.19,10.81-16.75,10.81-26.93 S91.43,8.22,84.46,1.02c-1.32-1.36-3.46-1.36-4.77,0c-1.32,1.37-1.32,3.57,0,4.93c5.69,5.88,8.83,13.69,8.83,22 c0,8.31-3.14,16.12-8.83,21.99C78.37,51.31,78.37,53.52,79.69,54.88"/><path d="M127.55,60.91c0.38,0,0.75-0.06,1.12-0.17l24.9-8.09c1.86-0.61,2.86-2.57,2.24-4.38 c-0.62-1.82-2.63-2.79-4.48-2.19l-24.9,8.09c-1.86,0.61-2.87,2.57-2.25,4.38C124.69,60,126.06,60.91,127.55,60.91"/><path d="M109.36,45.72c0.37,0.13,0.73,0.18,1.09,0.18c1.44,0,2.79-0.94,3.28-2.42l8.09-24.93 c0.6-1.86-0.38-3.87-2.19-4.49c-1.79-0.62-3.76,0.39-4.37,2.24l-8.09,24.93C106.58,43.09,107.55,45.1,109.36,45.72"/><path d="M109,64.92c1.88,0,3.64-0.73,4.95-2.06c2.73-2.74,2.73-7.19,0-9.96c-2.66-2.65-7.24-2.66-9.91,0.01 c-2.73,2.76-2.72,7.21,0.01,9.94C105.36,64.19,107.12,64.92,109,64.92"/><path d="M58,44.9c1.88,0,3.64-0.74,4.95-2.07c1.32-1.32,2.05-3.09,2.05-4.98c0-1.88-0.73-3.65-2.05-4.97 c-2.64-2.66-7.26-2.66-9.9-0.01C51.73,34.2,51,35.98,51,37.86c0,1.89,0.73,3.65,2.04,4.96C54.36,44.16,56.12,44.9,58,44.9"/><path d="M140,35.89c1.87,0,3.63-0.73,4.96-2.06c2.72-2.75,2.72-7.21-0.01-9.95c-2.64-2.66-7.26-2.66-9.9,0 c-2.73,2.75-2.73,7.2,0.01,9.96C136.37,35.16,138.13,35.89,140,35.89"/><path d="M131.05,93.93c-2.73,2.75-2.73,7.21,0,9.95c1.32,1.33,3.08,2.06,4.95,2.06s3.63-0.73,4.95-2.06 c2.73-2.75,2.73-7.21,0-9.96C138.3,91.27,133.7,91.27,131.05,93.93"/></svg>');
    }

    .success-box h2 {
        margin: 3rem;
        margin-bottom: 2rem;
        font-size: 3rem;
        letter-spacing: 0.021em;
        font-weight: 500;
    }

    .success-box p {
        margin: 2rem 3rem;
        width: 25rem;
    }

    .success-box p + p {
        width: 20rem;
        margin-bottom: 3rem;
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
        border-bottom: solid 1px rgba(0, 0, 0, 0.1);
    }

    .login-icon {
        height: 3rem;
        width: 3rem;
        flex-shrink: 0;
        margin-right: 1rem;
        background-repeat: no-repeat;
        background-position: center;
    }

    .login-icon.keyguard {
        background-image: url('data:image/svg+xml,<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 24 28" style="enable-background:new 0 0 24 28;" xml:space="preserve"><path fill="%23F5AF2D" d="M15.45,9.57c-0.15-0.3-0.57-0.53-0.89-0.53H9.42c-0.32,0-0.72,0.23-0.89,0.53l-2.57,4.49 c-0.15,0.28-0.15,0.76,0,1.03l2.57,4.49c0.17,0.3,0.57,0.53,0.89,0.53h5.14c0.35,0,0.74-0.23,0.89-0.53l2.57-4.49 c0.17-0.28,0.17-0.76,0-1.03L15.45,9.57z M23.58,5.29C23.83,5.36,24,5.59,24,5.85c0,10-0.87,17.98-11.8,22.11 C12.13,27.99,12.07,28,12,28c-0.07,0-0.13-0.01-0.2-0.04C0.87,23.83,0,15.85,0,5.85c0-0.26,0.17-0.49,0.42-0.56 c0.08-0.02,8.46-2.35,11.16-5.12c0.21-0.22,0.61-0.22,0.83,0C15.12,2.94,23.49,5.27,23.58,5.29z"/></svg>');
        background-size: auto 3rem;
    }

    .login-icon.ledger {
        background-image: url('data:image/svg+xml,<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 25 25" style="enable-background:new 0 0 25 25;" xml:space="preserve"><path fill="%23333745" d="M21.05,0H9.5V15.1H25l0-11.17C25,1.81,23.22,0,21.05,0"/><path fill="%23333745" d="M6.04,0H4.08C1.88,0,0,1.75,0,3.98v1.91h6.04V0z"/><rect fill="%23333745" y="9.21" width="6.08" height="5.92"/><path fill="%23333745" d="M18.92,25h1.97C23.11,25,25,23.24,25,21v-1.92h-6.08V25z"/><rect fill="%23333745" x="9.46" y="19.08" width="6.08" height="5.92"/><path fill="%23333745" d="M0,19.08V21c0,2.16,1.8,4,4.11,4h1.97v-5.92H0z"/></svg>');
        background-size: 2.5rem;
    }

    button.submit {
        margin: 2rem 8rem 4rem;
        width: calc(100% - 15.5rem);
        background: #24bdb6;
        color: white;
    }
</style>
