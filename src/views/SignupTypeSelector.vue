<template>
    <div>
        <PageHeader :progressIndicator="true" :numberSteps="6" :step="1">Add a Wallet</PageHeader>
        <div class="page-body">
            <p>A Wallet is like a login and can contain one or more accounts, which you can use to send or receive Nimiq, pay online and create Cashlinks.</p>
            <button @click="createKeyguard" class="purple-background keyguard-icon">
                <h2>Create Wallet</h2>
                <p>Create a Wallet in our secure Nimiq Keyguard. This is the most convenient option.</p>
            </button>
            <button @click="createLedger" class="ledger-icon">
                <h2>Connect Hardware Wallet</h2>
                <p>Connect a Hardware Wallet like Ledger. This option requires a physical device. It is the most secure option.</p>
            </button>
        </div>
        <PageFooter>
            <a onclick="alert('Not yet implemented')">Already have a wallet?</a>
        </PageFooter>
    </div>
</template>

<script lang="ts">
import {Component, Emit, Prop, Watch, Vue} from 'vue-property-decorator';
import {PageHeader, PageFooter} from '@nimiq/vue-components';
import {RequestType, ParsedSignupRequest} from '../lib/RequestTypes';
import {AddressInfo} from '../lib/AddressInfo';
import {KeyInfo, KeyStorageType} from '../lib/KeyInfo';
import {State, Mutation, Getter} from 'vuex-class';
import RpcApi from '../lib/RpcApi';
import {CreateRequest as KCreateRequest, CreateResult as KCreateResult} from '@nimiq/keyguard-client';
import {ResponseStatus, State as RpcState} from '@nimiq/rpc';
import staticStore, {Static} from '../lib/StaticStore';
import Config from 'config';

@Component({components: {PageHeader, PageFooter}})
export default class extends Vue {
    @Static private request!: ParsedSignupRequest;
    @State private keyguardResult!: KCreateResult | Error | null;
    @State private activeAccountPath!: string;

    public createKeyguard() {
        const client = RpcApi.createKeyguardClient(this.$store, staticStore, Config.keyguardEndpoint);

        const request: KCreateRequest = {
            appName: this.request.appName,
            defaultKeyPath: `m/44'/242'/0'/0'`,
        };

        client.create(request).catch(console.log); // TODO: proper error handling
    }

    public createLedger() {
        alert('Ledger-adding not yet implemented');
    }
}
</script>

<style scoped>
    .page-body {
        background: #fafafa;
        overflow: auto;
        padding-bottom: 16px;
    }

    p {
        margin: 32px;
        font-size: 16px;
        line-height: 1.3;
        opacity: 0.7;
    }

    button {
        font-weight: normal;
        text-transform: none;
        text-align: left;
        letter-spacing: 0;
        padding: 16px;
        border-radius: 4px;

        margin: 0 32px 16px;
        border: solid 2px #e5e5e5;
        box-shadow: unset;
        width: auto;
        background: transparent;
        position: relative;
    }

    button h2 {
        font-size: 18px;
        line-height: 20px;
        font-weight: 600;
        margin: 0 0 6.4px;
    }

    button p {
        margin: 0;
    }

    button.purple-background {
        background: #724ceb;
        color: white;
        border: none;
    }

    button.keyguard-icon::after,
    button.ledger-icon::after {
        content: '';
        display: block;
        background: #fafafa;
        height: 40px;
        width: 40px;
        border-radius: 50%;
        position: absolute;
        right: -12px;
        bottom: -12px;

        background-position: center;
        background-repeat: no-repeat;
    }

    button.keyguard-icon::after {
        background-image: url('data:image/svg+xml,<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 24 28" style="enable-background:new 0 0 24 28;" xml:space="preserve"><path fill="%23F5AF2D" d="M15.45,9.57c-0.15-0.3-0.57-0.53-0.89-0.53H9.42c-0.32,0-0.72,0.23-0.89,0.53l-2.57,4.49 c-0.15,0.28-0.15,0.76,0,1.03l2.57,4.49c0.17,0.3,0.57,0.53,0.89,0.53h5.14c0.35,0,0.74-0.23,0.89-0.53l2.57-4.49 c0.17-0.28,0.17-0.76,0-1.03L15.45,9.57z M23.58,5.29C23.83,5.36,24,5.59,24,5.85c0,10-0.87,17.98-11.8,22.11 C12.13,27.99,12.07,28,12,28c-0.07,0-0.13-0.01-0.2-0.04C0.87,23.83,0,15.85,0,5.85c0-0.26,0.17-0.49,0.42-0.56 c0.08-0.02,8.46-2.35,11.16-5.12c0.21-0.22,0.61-0.22,0.83,0C15.12,2.94,23.49,5.27,23.58,5.29z"/></svg>');
        background-size: auto 28px;
    }

    button.ledger-icon::after {
        background-image: url('data:image/svg+xml,<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 25 25" style="enable-background:new 0 0 25 25;" xml:space="preserve"><path fill="%23333745" d="M21.05,0H9.5V15.1H25l0-11.17C25,1.81,23.22,0,21.05,0"/><path fill="%23333745" d="M6.04,0H4.08C1.88,0,0,1.75,0,3.98v1.91h6.04V0z"/><rect fill="%23333745" y="9.21" width="6.08" height="5.92"/><path fill="%23333745" d="M18.92,25h1.97C23.11,25,25,23.24,25,21v-1.92h-6.08V25z"/><rect fill="%23333745" x="9.46" y="19.08" width="6.08" height="5.92"/><path fill="%23333745" d="M0,19.08V21c0,2.16,1.8,4,4.11,4h1.97v-5.92H0z"/></svg>');
        background-size: 25px;
    }

    .page-footer {
        padding: 28px 32px;
        height: auto;
    }

    .page-footer a {
        font-size: 16px;
        color: #2a60dd;
        text-decoration: underline;
        cursor: pointer;
    }
</style>
