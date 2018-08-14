<template>
    <div class="container">
        <PaymentInfoLine v-if="rpcState" style="color: white"
                         :amount="request.value"
                         :networkFee="request.fee"
                         :networkFeeEditable="false"
                         :origin="rpcState.origin"/>
        <small-page>
            <div class="visible-area">
                <div class="multi-pages" :style="`transform: translate3d(-${(page - 1) * 450}px, 0, 0)`">
                    <LoginSelector @login-selected="loginSelected"
                                   @add-login="addLogin"
                                   @back="close"
                                   :logins="keys"/>
                    <AccountSelector
                            @account-selected="(address) => accountSelected(selectedLoginId || preselectedLoginId, address)"
                            @switch-login="switchLogin"
                            @back="switchLogin"
                            :accounts="currentAccounts"
                            :loginLabel="currentLogin ? currentLogin.label : ''"
                            :loginType="currentLogin ? currentLogin.type : 0"
                            :show-switch-login="false"/>
                </div>
            </div>
        </small-page>
        <a class="global-close" @click="close">Cancel Payment</a>
    </div>
</template>

<script lang="ts">
import {Component, Emit, Prop, Watch, Vue} from 'vue-property-decorator';
import {AccountSelector, LoginSelector, PaymentInfoLine, SmallPage} from '@nimiq/vue-components';
import {AddressInfo} from '../lib/AddressInfo';
import {KeyInfo, KeyStorageType} from '../lib/KeyInfo';
import {ParsedCheckoutRequest} from '../lib/RequestTypes';
import {State, Mutation, Getter} from 'vuex-class';
import RpcApi from '../lib/RpcApi';
import {SignTransactionResult} from '../lib/keyguard/RequestTypes';
import {ResponseStatus, State as RpcState} from '@nimiq/rpc';

@Component({components: {PaymentInfoLine, SmallPage, AccountSelector, LoginSelector}})
export default class Checkout extends Vue {
    @State('keys') private keys!: KeyInfo[];
    @State('rpcState') private rpcState!: RpcState | null;
    @State('request') private request!: ParsedCheckoutRequest;
    @State('keyguardResult') private keyguardResult!: SignTransactionResult | Error | null;

    @Mutation('addKey') private addKey!: (key: KeyInfo) => any;

    @Prop(String) private preselectedLoginId!: string;

    private page: number = 1;
    private selectedLoginId: string|null = null; // undefined is not reactive

    private get currentLogin() {
        const loginId = this.selectedLoginId || this.preselectedLoginId || false;
        if (!loginId) return undefined;

        return this.keys.find((k) => k.id === loginId);
    }

    private get currentAccounts() {
        const login = this.currentLogin;
        if (!login) return [];
        return Array.from(login.addresses.values());
    }

    private loginSelected(login: string) {
        this.selectedLoginId = login;
        this.page = 2;
    }

    private switchLogin() {
        this.page = 1;
    }

    @Watch('keyguardResult')
    private onKeyguardResult() {
        if (this.keyguardResult instanceof Error) {
            console.log('Keyguard result:', this.keyguardResult);
            console.log('Rpc state:', this.rpcState);
            // TODO Rebuild the UI as it was before submitting to the Keyguard
        } else if (this.keyguardResult && this.rpcState) {
            // Forward signing result to original caller window
            this.rpcState.reply(ResponseStatus.OK, this.keyguardResult);

            // TODO Display success page
        }
    }

    @Emit()
    private addLogin() {
        // TODO
        const id: string = Math.round(Math.pow(2, 32) * Math.random()).toString(16);
        const map = new Map<string, AddressInfo>();
        map.set('a', new AddressInfo(
            'a',
            'My Account',
            Nimiq.Address.fromString('NQ09 VF5Y 1PKV MRM4 5LE1 55KV P6R2 GXYJ XYQF'),
        ));
        this.addKey(new KeyInfo(id, id, map, [], KeyStorageType.LEDGER));
    }

    @Emit()
    private accountSelected(login: string, address: Nimiq.Address) {
        const client = RpcApi.createKeyguardClient(this.$store);

        const key = this.keys.find((k: KeyInfo) => k.id === login);
        if (!key) return;

        let keyPath: string;
        let sender: Uint8Array;
        let senderType: Nimiq.Account.Type;
        let senderLabel: string;

        const addressInfos: AddressInfo[] = Array.from(key.addresses.values())
            .filter((addressInfo: AddressInfo) => addressInfo.address.equals(address));
        // Check if address exist or it might be a contract
        if (addressInfos.length === 1) {
            keyPath = addressInfos[0].path;
            sender = address.serialize();
            senderType = Nimiq.Account.Type.BASIC;
            senderLabel = addressInfos[0].label;
        } else {
            // TODO: Add contract support
            return;
        }

        client.signTransaction({
            layout: 'checkout',
            shopOrigin: this.rpcState ? this.rpcState.origin : '',
            appName: this.request.appName,

            keyId: key.id,
            keyPath,
            keyLabel: key.label,

            sender,
            senderType,
            senderLabel,
            recipient: this.request.recipient.serialize(),
            recipientType: this.request.recipientType,
            recipientLabel: undefined, // TODO: recipient label
            value: this.request.value,
            fee: this.request.fee || 0, // TODO: proper fee estimation
            validityStartHeight: 1234, // TODO: get valid start height
            data: this.request.data,
            flags: this.request.flags,
            networkId: this.request.networkId,
        }).catch(console.error); // TODO: proper error handling
    }

    private close() {
        window.close();
    }
}
</script>

<style scoped>
    .container {
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .visible-area {
        overflow: hidden;
        flex: 1;
        display: flex
    }

    .multi-pages {
        position: relative;
        flex: 1;
        display: grid;
        grid-template-columns: 100vw 100vw;
        will-change: transform;
        transition: all 400ms ease-in-out;
    }

    @media (min-width: 450px) {
        .multi-pages {
            grid-template-columns: 450px 450px;
        }
    }


    .global-close {
        display: inline-block;
        height: 27px;
        border-radius: 13.5px;
        background-color: rgba(0, 0, 0, 0.1);
        font-size: 14px;
        font-weight: 600;
        line-height: 27px;
        color: white;
        padding: 0 12px;
        cursor: pointer;
        margin-top: 64px;
        margin-bottom: 40px;
    }

    .global-close::before {
        content: '';
        display: inline-block;
        height: 11px;
        width: 11px;
        background-image: url('data:image/svg+xml,<svg height="24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M0 0h24v24H0z" fill="none"/><path fill="%23fff" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>');
        background-repeat: no-repeat;
        background-size: 16px;
        background-position: center;
        margin-right: 8px;
        margin-bottom: -1px;
    }
</style>
