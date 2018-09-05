<template>
    <div>
        Choose a label for your account:
        <Account :address="createdAccount.address" />
        <input type= "text" v-model.lazy="label" />
        <button @click="submit" :disabled="label === null || label === ''">Ok</button>
    </div>
</template>

<script lang="ts">
import {Component, Emit, Prop, Watch, Vue} from 'vue-property-decorator';
import {Account} from '@nimiq/vue-components';
import {RequestType, ParsedSignupRequest} from '../lib/RequestTypes';
import {AddressInfo} from '../lib/AddressInfo';
import {KeyInfo, KeyStorageType} from '../lib/KeyInfo';
import {KeyStore} from '../lib/KeyStore';
import {State, Mutation, Getter} from 'vuex-class';
import RpcApi from '../lib/RpcApi';
import {CreateRequest as KCreateRequest, CreateResult as KCreateResult} from '@nimiq/keyguard-client';
import {ResponseStatus, State as RpcState} from '@nimiq/rpc';

@Component({components: {Account}})
export default class extends Vue {
    @State private rpcState!: RpcState;
    @State private keyguardResult!: KCreateResult;
    @State private chosenLoginLabel!: string;

    private label: string | null = null;

    private submit() {
        const keyInfo = new KeyInfo(
            this.keyguardResult.keyId,
            this.chosenLoginLabel,
            new Map().set(this.label, this.keyguardResult.address),
            [],
            KeyStorageType.BIP39,
        );

        KeyStore.Instance.put(keyInfo);

        this.rpcState.reply(ResponseStatus.OK, keyInfo);
    }
}
</script>

<style scoped>
   
</style>
