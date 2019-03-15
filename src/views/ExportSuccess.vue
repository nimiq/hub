<template>
    <div class="container pad-bottom">
        <SmallPage>
            <Loader state="success">
                <template slot="success">
                    <div class="success nq-icon"></div>
                    <h1 class="title nq-h1">Account backed up!</h1>
                </template>
            </Loader>
        </SmallPage>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { SmallPage } from '@nimiq/vue-components';
import { ExportResult } from '@/lib/RequestTypes';
import { State, Getter } from 'vuex-class';
import { Static } from '@/lib/StaticStore';
import Loader from '@/components/Loader.vue';
import { WalletInfo } from '@/lib/WalletInfo';
import { WalletStore } from '@/lib/WalletStore';
import KeyguardClient from '@nimiq/keyguard-client';

@Component({components: {SmallPage, Loader}})
export default class ExportSuccess extends Vue {
    @Static private keyguardRequest!: KeyguardClient.SimpleRequest;
    @State private keyguardResult!: KeyguardClient.ExportResult;

    @Getter private findWallet!: (id: string) => WalletInfo | undefined;

    private async mounted() {
        const wallet = this.findWallet(this.keyguardRequest.keyId);
        if (!wallet) {
            this.$rpc.reject(new Error('walletId not found'));
            return;
        }

        wallet.fileExported = wallet.fileExported || this.keyguardResult.file;
        wallet.wordsExported = wallet.wordsExported || this.keyguardResult.words;

        await WalletStore.Instance.put(wallet);

        const result: ExportResult = {
            success: true,
            fileExported: wallet.fileExported,
            wordsExported: wallet.wordsExported,
        };

        setTimeout(() => this.$rpc.resolve(result), Loader.SUCCESS_REDIRECT_DELAY);
    }
}
</script>
