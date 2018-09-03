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
            KeyStorageType.BIP39
        );

        KeyStore.Instance.put(keyInfo);

        this.rpcState.reply(ResponseStatus.OK, keyInfo);
    }
}
</script>

<style scoped>
    .container {
        display: flex;
        flex-direction: column;
        align-items: center;
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

    .global-close.hidden {
        visibility: hidden;
        pointer-events: none;
    }
</style>
