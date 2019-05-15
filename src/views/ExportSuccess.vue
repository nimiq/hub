<template>
    <div class="container pad-bottom">
        <SmallPage>
            <Loader :state="loaderState">
                <template slot="success">
                    <CheckmarkIcon/>
                    <h1 class="title nq-h1">{{successMessage}}</h1>
                </template>
            </Loader>
        </SmallPage>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { SmallPage, CheckmarkIcon } from '@nimiq/vue-components';
import { ParsedSimpleRequest, RequestType } from '../lib/RequestTypes';
import { ExportResult } from '../lib/PublicRequestTypes';
import { State } from 'vuex-class';
import staticStore, { Static } from '@/lib/StaticStore';
import Loader from '@/components/Loader.vue';
import { WalletStore } from '@/lib/WalletStore';
import KeyguardClient from '@nimiq/keyguard-client';

@Component({components: {SmallPage, Loader, CheckmarkIcon}})
export default class ExportSuccess extends Vue {
    @Static private request!: ParsedSimpleRequest;
    @State private keyguardResult!: KeyguardClient.ExportResult;

    private loaderState = Loader.State.LOADING;
    private successMessage = '';

    private async mounted() {
        let result: ExportResult;

        // When doing pre-migration exports, or the request is MIGRATE, no wallet will be found.
        const wallet = this.request.walletId ? await WalletStore.Instance.get(this.request.walletId) : null;

        if (wallet) {
            wallet.fileExported = wallet.fileExported || this.keyguardResult.fileExported;
            wallet.wordsExported = wallet.wordsExported || this.keyguardResult.wordsExported;

            result = {
                fileExported: wallet.fileExported,
                wordsExported: wallet.wordsExported,
            };
        } else {
            result = {
                fileExported: this.keyguardResult.fileExported,
                wordsExported: this.keyguardResult.wordsExported,
            };
        }

        if (this.keyguardResult.fileExported) {
            if (this.keyguardResult.wordsExported) {
                this.successMessage = 'Account backed up!';
            } else {
                this.successMessage = 'Login File exported!';
            }
        } else if (this.keyguardResult.wordsExported) {
            this.successMessage = 'Recovery Words exported!';
        } else {
            this.$rpc.resolve(result);
            return;
        }

        if (wallet) {
            await WalletStore.Instance.put(wallet);
        }

        this.loaderState = Loader.State.SUCCESS;

        if (wallet) {
            setTimeout(() => this.$rpc.resolve(result), Loader.SUCCESS_REDIRECT_DELAY);
        } else {
            // This was a pre-migration legacy account export

            // We need to hijack the routing here, so that we do not go through RpcApi's reply method.
            // Going through that method would redirect the user to the originalRouteName, but it would
            // not go through the registered AccountsApis, thus not checking the need to migrate,
            // and thus not setting the originalRouteName again, thus losing the type of the original request.
            // We want the RpcApi's reply method to only be invoked when migration is finished.

            // Recreate original URL with original query parameters
            const query = { id: staticStore.rpcState!.id.toString() };
            setTimeout(
                () => this.$router.push({ name: RequestType.MIGRATE, query }), Loader.SUCCESS_REDIRECT_DELAY);
        }
    }
}
</script>
