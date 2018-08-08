<template>
    <div>
        <PaymentInfoLine style="color: white" :amount="199000" :networkFee="1000" :networkFeeEditable="false"
                         origin="shop.nimiq.com"/>
        <small-page>
            <div class="visible-area">
                <div class="multi-pages" :style="'left: -'+((page-1)*100)+'%'">
                    <LoginSelector @login-selected="loginSelected"
                                   @add-login="addLogin"
                                   :logins="logins()"/>
                    <AccountSelector
                            @account-selected="(address) => accountSelected(selectedLogin || preselectedLogin, address)"
                            @switch-login="switchLogin"
                            :accounts="accounts()"/>
                </div>
            </div>
        </small-page>
    </div>
</template>

<script lang="ts">
    import {Component, Emit, Prop, Vue} from 'vue-property-decorator';
    import {AccountSelector, LoginSelector, PaymentInfoLine, SmallPage} from '@nimiq/vue-components';
    import {AddressInfo} from "../lib/AddressInfo";
    import {KeyInfo, KeyStorageType} from "../lib/KeyInfo";
    import {ParsedCheckoutRequest} from '../lib/Requests';
    import {Mutation, State} from 'vuex-class';

    @Component({components: {PaymentInfoLine, SmallPage, AccountSelector, LoginSelector}})
    export default class Checkout extends Vue {
        @State('keys') private keys!: KeyInfo[];
        @State('request') private request!: ParsedCheckoutRequest;

        @Mutation('addKey') private addKey!: (key: KeyInfo) => any;

        @Prop(String) private preselectedLogin!: string;

        private page: number = 1;
        private selectedLogin?: string;

        // constructor() {
        //     super();
        //     KeyStore.Instance.list().then(keys => {
        //         this.logins = keys.map((keyInfo: KeyInfo) => {
        //             const accounts = Array.from(keyInfo.addresses.values()).map((address: AddressInfo) => {
        //                 return {
        //                     label: address.label,
        //                     address: address.address
        //                 };
        //             });
        //             this.accounts.set(keyInfo.id, accounts);
        //             return {
        //                 label: keyInfo.label,
        //                 userFriendlyId: keyInfo.id,
        //                 id: keyInfo.id
        //             };
        //         });
        //     });
        // }

        private logins() {
            return this.keys.map((key: KeyInfo) => ({
                id: key.id,
                label: key.label,
                userFriendlyId: 'to do',
            }));
        }

        private accounts() {
            const login: string = (this.selectedLogin || this.preselectedLogin);
            const filteredKeys = this.keys.filter((key: KeyInfo) => key.id == login);
            if (filteredKeys.length !== 1) return [];
            return Array.from(filteredKeys[0].addresses.values()).map((address: AddressInfo) => ({
                address: address.address,
                label: address.label,
            }));
        }

        private loginSelected(login: string) {
            this.selectedLogin = login;
            this.page = 2;
        }

        private switchLogin() {
            this.page = 1;
        }

        @Emit()
        // tslint:disable-next-line
        private addLogin() {
            // TODO
            const id: string = Math.round(Math.pow(2, 32) * Math.random()).toString(16);
            const map = new Map<string, AddressInfo>();
            map.set('a', new AddressInfo('a', 'My Account', Nimiq.Address.fromString('NQ09 VF5Y 1PKV MRM4 5LE1 55KV P6R2 GXYJ XYQF')));
            this.addKey(new KeyInfo(id, id, map, [], KeyStorageType.LEDGER));
        }

        @Emit()
        // tslint:disable-next-line
        private accountSelected(login: string, address: Nimiq.Address) {
        }
    }
</script>

<style scoped>

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
        transition: all .5s ease-in-out;
    }

    @media (min-width: 490px) {
        .multi-pages {
            grid-template-columns: 28em 28em;
        }
    }
</style>
