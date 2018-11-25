<template>
    <div v-if="isVisibleRoute" class="container">
        <SmallPage>
            <router-view/>
        </SmallPage>
        <button class="global-close nq-button-s" :class="{'hidden': $route.name === 'sign-message-success'}" @click="close">
            <span class="nq-icon arrow-left"></span>
            Back to {{request.appName}}
        </button>
    </div>
</template>

<script lang="ts">
import { Component, Emit, Vue } from 'vue-property-decorator';
import { State } from 'vuex-class';
import { SmallPage } from '@nimiq/vue-components';
import { RequestType, ParsedSignMessageRequest } from '../lib/RequestTypes';
import { State as RpcState, ResponseStatus } from '@nimiq/rpc';
import staticStore, { Static } from '../lib/StaticStore';
import { WalletStore } from '@/lib/WalletStore';
import { AccountInfo } from '@/lib/AccountInfo';
import { WalletInfo } from '@/lib/WalletInfo';
import {
    SignMessageRequest as KSignMessageRequest,
    SignMessageResult as KSignMessageResult,
} from '@nimiq/keyguard-client';
import RpcApi from '../lib/RpcApi';
import Utf8Tools from '../lib/Utf8Tools';

@Component({components: {SmallPage}})
export default class SignMessage extends Vue {
    @Static protected rpcState!: RpcState;
    @Static protected request!: ParsedSignMessageRequest;
    @State private keyguardResult!: KSignMessageResult;

    protected sendKeyguardRequest(walletInfo: WalletInfo, accountInfo: AccountInfo) {
        const request: KSignMessageRequest = {
            appName: this.request.appName,

            keyId: walletInfo.id,
            keyPath: accountInfo.path,

            message: this.messageBytes,

            signer: accountInfo.address.serialize(),
            signerLabel: accountInfo.label,
        };

        const storedRequest = Object.assign({}, request, {
            signer: Array.from(request.signer),
            message: Array.from(request.message),
        });
        staticStore.keyguardRequest = storedRequest;

        const client = RpcApi.createKeyguardClient(this.$store, staticStore);
        client.signMessage(request).catch(console.error); // TODO: proper error handling
    }

    protected get messageBytes(): Uint8Array {
        if (this.request.message instanceof Uint8Array) return this.request.message;
        return Utf8Tools.stringToUtf8ByteArray(this.request.message);
    }

    private async created() {
        // Only run when not returning from Keyguard
        if (this.keyguardResult) return;

        let walletInfo: WalletInfo | null = null;
        let accountInfo: AccountInfo | null = null;

        if (this.request.walletId && this.request.signer) {
            walletInfo = await WalletStore.Instance.get(this.request.walletId);
            if (!walletInfo) {
                // XXX Should we really return an error here and when checking the address below,
                // or would it enable malicous sites to query for stored walletIds and addresses?
                // We can also quietly ignore any unavailable pre-set walletId and address and give
                // the user the option to chose as if it was not pre-set.
                this.rpcState.reply(ResponseStatus.ERROR, new Error('WalletId not found'));
                return;
            }
            accountInfo = walletInfo.accounts.get(this.request.signer.toUserFriendlyAddress()) || null;
            if (!accountInfo) {
                this.rpcState.reply(ResponseStatus.ERROR, new Error('Signer account not found'));
                return;
            }
        }

        if (!accountInfo) {
            // Display interface for the user to select signer account
            this.$router.push({name: `${RequestType.SIGN_MESSAGE}-overview`});
            return;
        }

        // Forward directly to Keyguard
        this.sendKeyguardRequest(walletInfo!, accountInfo);
    }

    private get isVisibleRoute() {
        return this.$route.name === `${RequestType.SIGN_MESSAGE}-overview`
            || this.$route.name === `${RequestType.SIGN_MESSAGE}-change-account`
            || this.$route.name === `${RequestType.SIGN_MESSAGE}-success`;
    }

    @Emit()
    private close() {
        this.rpcState.reply(ResponseStatus.ERROR, new Error('CANCEL'));
    }
}
</script>
