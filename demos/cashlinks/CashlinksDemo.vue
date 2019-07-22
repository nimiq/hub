<template>
    <div>
        <small>Using these buttons <strong>irrevocably overwrites</strong> a currently loaded cashlink:</small><br>
        <button class="enabled-by-nimiq" @click="createCashlink" :disabled="!isNimiqLoaded()">Create Cashlink</button>
        <button class="enabled-by-nimiq" @click="loadCashlink()" :disabled="!isNimiqLoaded()">Load Cashlink</button>

        <h2>Cashlink Info</h2>
        <div v-if="cashlink">
            <dl>
                <dt>Address</dt>
                <dd>{{ cashlink.address.toUserFriendlyAddress() }}</dd>
                <dt>Value</dt>
                <dd>{{ cashlink.value / 1e5 }} NIM <button @click="changeValue" :disabled="!canBeEdited">change</button></dd>
                <dt>Message</dt>
                <dd>{{ cashlink.message }} <button @click="changeMessage" :disabled="!canBeEdited">change</button></dd>
                <dt>State</dt>
                <dd>{{ cashlinkState(cashlink.state) }} ({{ cashlink.state }}) <button @click="detectState">Detect</button></dd>
                <dt>Link</dt>
                <dd>{{ link }}</dd>
            </dl>
            <button @click="fund" :disabled="!canBeFunded">Fund</button>
            <button @click="claim" :disabled="!canBeClaimed">Claim</button>
            <br><small><em>Funding uses the Checkout UI for now because the Cashlink UI does not yet exist.</em></small>
        </div>

        <h2>Network Status</h2>
        <div>Consensus: {{ network.consensusState }}</div>
    </div>
</template>

<script lang="ts">
import { Component, Watch, Vue } from 'vue-property-decorator';
import { State } from 'vuex-class';
import { RpcClient } from '@nimiq/rpc';
import HubApi from '../../client/HubApi';
import { Address, CheckoutRequest } from '../../src/lib/PublicRequestTypes';
import Cashlink, { CashlinkState } from '../../src/lib/Cashlink';
import { NetworkClient } from '@nimiq/network-client';

@Component
export default class CashlinksDemo extends Vue {
    private myAddress: Address = {
        address: '-',
        label: '-'
    };
    private _hubApi!: HubApi;
    private cashlink: Cashlink | null = null;
    private network: NetworkClient = NetworkClient.Instance;

    public async created() {
        this._hubApi = new HubApi();
        await this.network.init();
        this.network.connectPico();

        this.loadCashlink(window.location.href);
    }

    private createCashlink() {
        this.cashlink = Cashlink.create();
        this.cashlink.networkClient = this.network;
        this.network.subscribe(this.cashlink.address.toUserFriendlyAddress());
    }

    private loadCashlink(url?: string) {
        const link = url || prompt('Enter cashlink URL:');
        if (!link) return;
        try {
            const fragment = new URL(link).hash.substring(1);
            if (!fragment) return;
            const cashlink = Cashlink.parse(fragment);
            if (!cashlink) return;
            this.cashlink = cashlink;

            this.cashlink.networkClient = this.network;
            this.network.subscribe(this.cashlink.address.toUserFriendlyAddress());
        } catch (e) {
            alert(e.message);
        }
    }

    private changeValue() {
        const value = prompt('Set value in NIM:', (this.cashlink!.value / 1e5).toString(10));
        if (!value) return;
        try {
            this.cashlink!.value = parseFloat(value) * 1e5;
        } catch (e) {
            alert(e.message);
        }
    }

    private changeMessage() {
        const message = prompt('Set message:', this.cashlink!.message) || this.cashlink!.message;
        try {
            this.cashlink!.message = message;
        } catch (e) {
            alert(e.message);
        }
    }

    private detectState() {
        this.cashlink!.detectState();
    }

    private get link() {
        return window.location.origin + window.location.pathname + '#' + this.cashlink!.render();
    }

    private async fund() {
        const fundingDetails = this.cashlink!.getFundingDetails();
        const request: CheckoutRequest = Object.assign({}, fundingDetails, {
            appName: 'Cashlink Demo',
            // fundingDetails returns an object made for direct use with the KeyguardClient.
            // Here we go through the Hub first, so we have to adjust some fields:
            extraData: fundingDetails.data,
            recipient: new Nimiq.Address(fundingDetails.recipient).toUserFriendlyAddress(),
        });
        try {
            const result = await this._hubApi.checkout(request);
            // @ts-ignore
            window.fundingTx = result;
            console.log(result);
        } catch (e) {
            console.warn(e);
        }
    }

    private async claim() {
        try {
            const recipient = await this._hubApi.chooseAddress({appName: 'Cashlink Demo'});
            await this.cashlink!.claim(recipient.address);
            console.log('Cashlink claimed!');
        } catch (e) {
            console.warn(e);
        }
    }

    private cashlinkState(state: number): string {
        const stateDict: {[state: string]: string} = {
            '-1': 'UNKNOWN',
             '0': 'UNCHARGED',
             '1': 'CHARGING',
             '2': 'UNCLAIMED',
             '3': 'CLAIMING',
             '4': 'CLAIMED',
        };

        return stateDict[state.toString(10)];
    }

    private isNimiqLoaded() {
        return !!window.Nimiq && Nimiq.Module;
    }

    private get canBeFunded() {
        return this.cashlink!.state === CashlinkState.UNCHARGED;
    }

    private get canBeClaimed() {
        console.log(this.cashlink!.state);
        return this.cashlink!.state === CashlinkState.UNCLAIMED;
    }

    private get canBeEdited() {
        return this.cashlink!.state === CashlinkState.UNCHARGED;
    }
}
</script>

<style scoped>

</style>
