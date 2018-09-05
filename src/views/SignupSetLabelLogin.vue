<template>
    <div>
        Choose a label for your created login:
        <input type="text" v-model.lazy="label" />
        <button @click="submit" :disabled="label === null || label === ''">Ok</button>
    </div>
</template>

<script lang="ts">
import {Component, Emit, Prop, Watch, Vue} from 'vue-property-decorator';
import {AccountSelector, LoginSelector, PaymentInfoLine, SmallPage} from '@nimiq/vue-components';
import {RequestType, ParsedSignupRequest} from '../lib/RequestTypes';
import {AddressInfo} from '../lib/AddressInfo';
import {KeyInfo, KeyStorageType} from '../lib/KeyInfo';
import {State, Mutation, Getter} from 'vuex-class';
import RpcApi from '../lib/RpcApi';
import {CreateRequest as KCreateRequest, CreateResult as KCreateResult} from '@nimiq/keyguard-client';
import {ResponseStatus, State as RpcState} from '@nimiq/rpc';

@Component({components: {SmallPage}})
export default class extends Vue {
    @State private request!: ParsedSignupRequest;
    @State private keyguardResult!: KCreateResult | Error | null;
    @State private activeAccountPath!: string;

    @Mutation private setLoginLabel!: (label: string) => any;

    private label: string | null = null;

    @Emit()
    public submit() {
        this.setLoginLabel(this.label!);
        this.$router.push({name: `${RequestType.SIGNUP}-set-label-address`});
    }
}
</script>

<style scoped>
   
</style>
