<template>
    <div class="container pad-bottom">
        <SmallPage>
            <Loader :state="loaderState">
                <template slot="success">
                    <div class="success nq-icon"></div>
                    <h1 class="title nq-h1">{{successMessage}}</h1>
                </template>
            </Loader>
        </SmallPage>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { SmallPage } from '@nimiq/vue-components';
import { ParsedSimpleRequest } from '../lib/RequestTypes';
import { ExportResult } from '../lib/PublicRequestTypes';
import { State } from 'vuex-class';
import { Static } from '@/lib/StaticStore';
import Loader from '@/components/Loader.vue';
import { WalletInfo } from '@/lib/WalletInfo';
import { WalletStore } from '@/lib/WalletStore';
import KeyguardClient from '@nimiq/keyguard-client';

@Component({components: {SmallPage, Loader}})
export default class ExportSuccess extends Vue {
    @Static private request!: ParsedSimpleRequest;
    @State private keyguardResult!: KeyguardClient.ExportResult;

    private loaderState = Loader.State.LOADING;
    private successMessage = '';

    private async mounted() {
        const wallet = (await WalletStore.Instance.get(this.request.walletId))!;

        wallet.fileExported = wallet.fileExported || this.keyguardResult.fileExported;
        wallet.wordsExported = wallet.wordsExported || this.keyguardResult.wordsExported;

        const result: ExportResult = {
            fileExported: wallet.fileExported,
            wordsExported: wallet.wordsExported,
        };

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

        await WalletStore.Instance.put(wallet);

        this.loaderState = Loader.State.SUCCESS;
        setTimeout(() => this.$rpc.resolve(result), Loader.SUCCESS_REDIRECT_DELAY);
    }
}
</script>
