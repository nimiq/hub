<template>
    <div>
        Success! Created wallet and account.
        <Account :address="createdAddress" />
        <div v-if="!noWallets">
            <input type= "text" v-model.lazy="walletLabel" placeholder="Keyguard Wallet" />
            <input type= "text" v-model.lazy="addressLabel" placeholder="Standard Account" />
        </div>
        <button @click='done'>Done</button>
    </div>
</template>

<script lang="ts">
import {Component, Emit, Prop, Watch, Vue} from 'vue-property-decorator';
import {Account} from '@nimiq/vue-components';
import {RequestType, ParsedSignupRequest} from '../lib/RequestTypes';
import {AddressInfo} from '../lib/AddressInfo';
import {KeyInfo, KeyStorageType, KeyInfoEntry} from '../lib/KeyInfo';
import {State, Mutation, Getter} from 'vuex-class';
import {KeyStore} from '../lib/KeyStore';
import RpcApi from '../lib/RpcApi';
import {CreateRequest as KCreateRequest, CreateResult as KCreateResult} from '@nimiq/keyguard-client';
import {ResponseStatus, State as RpcState} from '@nimiq/rpc';

@Component({components: {Account}})
export default class extends Vue {
    @State private rpcState!: RpcState;
    @State private request!: ParsedSignupRequest;
    @State private keyguardResult!: KCreateResult;
    @State private activeAccountPath!: string;
    @Getter private noWallets!: boolean;

    private keyInfo: KeyInfo | null = null;
    private addressLabel: string | null = null;
    private walletLabel: string | null = null;
    private createdAddress: Nimiq.Address | null = null;

    public mounted() {
        this.createdAddress = new Nimiq.Address(this.keyguardResult.address);
        this.saveResult('Keyguard Wallet', 'Standard Account');
    }

    public unmounted() {
        this.done();
    }

    public async done() {
        if (this.walletLabel) {
            this.keyInfo!.label = this.walletLabel;
        }

        if (this.addressLabel) {
            const addressInfo = new AddressInfo(
                this.keyguardResult.keyPath,
                this.addressLabel,
                this.createdAddress!,
            );

            this.keyInfo!.addresses.set(this.keyguardResult.keyPath, addressInfo);
        }

        if (this.walletLabel || this.addressLabel) {
            await KeyStore.Instance.put(this.keyInfo!);
        }

        this.rpcState.reply(ResponseStatus.OK, this.keyInfo);
        window.close();
    }

    private async saveResult(walletLabel: string, accountLabel: string) {
        const addressInfo = new AddressInfo(
            this.keyguardResult.keyPath,
            accountLabel,
            this.createdAddress!,
        );

        this.keyInfo = new KeyInfo(
            this.keyguardResult.keyId,
            walletLabel,
            new Map().set(this.keyguardResult.keyPath, addressInfo),
            [],
            KeyStorageType.BIP39,
        );

        await KeyStore.Instance.put(this.keyInfo);
    }
}
</script>

<style scoped>

</style>
