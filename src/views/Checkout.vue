<template>
    <div>
        <PaymentInfoLine style="color: white" :amount="199000" :networkFee="1000" :networkFeeEditable="false"
                         origin="shop.nimiq.com"/>
        <small-page>
            <div class="visible-area">
                <div class="multi-pages" :style="'left: -'+((page-1)*100)+'%'">
                    <LoginSelector @login-selected="loginSelected"
                                   @add-login="addLogin"
                                   :logins="logins"/>
                    <AccountSelector
                            @account-selected="(address) => accountSelected(selectedLogin || preselectedLogin, address)"
                            @switch-login="switchLogin"
                            :accounts="currentAccounts()"/>
                </div>
            </div>
        </small-page>
    </div>
</template>

<script lang="ts">
    import {Component, Emit, Prop, Vue} from 'vue-property-decorator';
    import {AccountSelector, LoginSelector, PaymentInfoLine, SmallPage} from '@nimiq/vue-components';
    import {KeyStore} from "../lib/KeyStore";
    import {KeyInfo} from "../lib/KeyInfo";
    import {AddressInfo} from "../lib/AddressInfo";

    @Component({components: {PaymentInfoLine, SmallPage, AccountSelector, LoginSelector}})
    export default class Checkout extends Vue {
        private logins: Array<{ label: string, userFriendlyId: string, id: string }> = [];
        private preselectedLogin!: string;
        private accounts: Map<string, Array<{ label: string, address: Nimiq.Address, balance?: number }>> = new Map();

        private page: number = 1;
        private selectedLogin?: string;

        constructor() {
            super();
            KeyStore.Instance.list().then(keys => {
                this.logins = keys.map((keyInfo: KeyInfo) => {
                    const accounts = Array.from(keyInfo.addresses.values()).map((address: AddressInfo) => {
                        return {
                            label: address.label,
                            address: address.address
                        };
                    });
                    this.accounts.set(keyInfo.id, accounts);
                    return {
                        label: keyInfo.label,
                        userFriendlyId: keyInfo.id,
                        id: keyInfo.id
                    };
                });
            });
        }

        private currentAccounts() {
            return this.accounts.get(this.selectedLogin || this.preselectedLogin) || [];
        }

        @Emit()
        private loginSelected(login: string) {
            this.selectedLogin = login;
            this.page = 2;
        }

        @Emit()
        private switchLogin() {
            this.page = 1;
        }

        @Emit()
        // tslint:disable-next-line
        private addLogin() {
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
