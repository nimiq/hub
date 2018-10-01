<template>
    <div class="visible-area">
        <div class="multi-pages" :style="`transform: translate3d(-${(page - 1) * 450}px, 0, 0)`">
            <LoginSelector @login-selected="loginSelected"
                            @account-selected="accountSelected"
                            @add-login="addLogin"
                            @back="backToOverview"
                            :logins="keys"/>
            <AccountSelector
                    @account-selected="accountSelected"
                    @switch-login="switchLogin"
                    @back="switchLogin"
                    :accounts="currentAccounts"
                    :loginId="currentLogin ? currentLogin.id : ''"
                    :loginLabel="currentLogin ? currentLogin.label : ''"
                    :loginType="currentLogin ? currentLogin.type : 0"
                    :show-switch-login="!!this.preselectedLoginId"/>
        </div>
    </div>
</template>

<script lang="ts">
import {Component, Emit, Vue} from 'vue-property-decorator';
import {AccountSelector, LoginSelector} from '@nimiq/vue-components';
import {AddressInfo} from '../lib/AddressInfo';
import {KeyInfo, KeyStorageType} from '../lib/KeyInfo';
import {RequestType} from '../lib/RequestTypes';
import {State, Mutation} from 'vuex-class';

@Component({components: {AccountSelector, LoginSelector}})
export default class CheckoutSelectAccount extends Vue {
    @State('keys') private keys!: KeyInfo[];

    @Mutation('addKey') private addKey!: (key: KeyInfo) => any;

    private page: number = 1;
    private selectedLoginId: string|null = null;
    private preselectedLoginId: string|null = null;

    private created() {
        console.log('Keys:', this.keys);
        if (this.keys.length === 1) {
            this.preselectedLoginId = this.keys[0].id;
            this.page = 2;
        }
    }

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

    private loginSelected(loginId: string) {
        this.selectedLoginId = loginId;
        this.page = 2;
    }

    private switchLogin() {
        // TODO Redirect to import/create just like addLogin()

        this.page = 1;
    }

    @Emit()
    private addLogin() {
        // TODO Redirect to import/create

        const id: string = Math.round(Math.pow(2, 32) * Math.random()).toString(16);
        const map = new Map<string, AddressInfo>();
        map.set('NQ09 VF5Y 1PKV MRM4 5LE1 55KV P6R2 GXYJ XYQF', new AddressInfo(
            'a',
            'My Account',
            Nimiq.Address.fromString('NQ09 VF5Y 1PKV MRM4 5LE1 55KV P6R2 GXYJ XYQF'),
        ));
        this.addKey(new KeyInfo(id, id, map, [], KeyStorageType.LEDGER));
    }

    @Emit()
    private accountSelected(loginId: string, address: Nimiq.Address) {
        const key = this.keys.find((k: KeyInfo) => k.id === loginId);
        if (!key) return;

        const addressInfo = Array.from(key.addresses.values())
            .find((ai: AddressInfo) => ai.address.equals(address));
        if (!addressInfo) return;

        this.$store.commit('setActiveAccount', {
            loginId: key.id,
            userFriendlyAddress: addressInfo.userFriendlyAddress,
        });

        // Return to overview
        this.backToOverview();
    }

    private backToOverview() {
        this.$router.push({name: RequestType.CHECKOUT});
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
        will-change: transform;
        transition: all 400ms ease-in-out;
    }

    @media (min-width: 450px) {
        .multi-pages {
            grid-template-columns: 450px 450px;
        }
    }
</style>
