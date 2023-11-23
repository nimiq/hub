<template>
    <div class="container pad-bottom">
        <SmallPage>
            <StatusScreen state="success" :title="$t('Login successful')"/>
        </SmallPage>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { State, Getter } from 'vuex-class';
import { State as RpcState } from '@nimiq/rpc';
import { ConnectedAccount } from '../../client/PublicRequestTypes';
import KeyguardClient from '@nimiq/keyguard-client';
import { Static } from '@/lib/StaticStore';
import StatusScreen from '../components/StatusScreen.vue';
import { SmallPage, CheckmarkIcon } from '@nimiq/vue-components';
import { WalletInfo } from '../lib/WalletInfo';
import { WalletType } from '../lib/Constants';
import { loadNimiq } from '../lib/Helpers';
import { ParsedConnectAccountRequest } from '../lib/RequestTypes';
import { WalletStore } from '../lib/WalletStore';

@Component({components: {StatusScreen, SmallPage, CheckmarkIcon}})
export default class ConnectAccountSuccess extends Vue {
    @Static protected rpcState!: RpcState;
    @Static protected request!: ParsedConnectAccountRequest;
    @Static private keyguardRequest!: KeyguardClient.ConnectRequest;
    @State private keyguardResult!: KeyguardClient.ConnectResult;
    @Getter private findWalletByKeyId!: (keyId: string) => WalletInfo | undefined;

    private async mounted() {
        const startTime = Date.now();

        const nimiqPromise = loadNimiq(); // Required for deriving address from public key

        const wallet = this.findWalletByKeyId(this.keyguardRequest.keyId)!;

        const walletTypeName: Record<WalletType, string> = {
            [WalletType.LEGACY]: 'LEGACY',
            [WalletType.BIP39]: 'BIP39',
            [WalletType.LEDGER]: 'LEDGER',
        };

        // Store permissions on wallet
        const walletPermissions = wallet.permissions[this.rpcState.origin] || [];
        walletPermissions.push(...this.request.permissions);
        wallet.permissions[this.rpcState.origin] = walletPermissions;
        await WalletStore.Instance.put(wallet);

        await nimiqPromise;

        const result: ConnectedAccount = {
            signatures: this.keyguardResult.signatures.map(({signature, publicKey}) => ({
                signer: new Nimiq.PublicKey(publicKey).toAddress().toUserFriendlyAddress(),
                signerPublicKey: publicKey,
                signature,
            })),
            encryptionKey: this.keyguardResult.encryptionKey,
            account: {
                label: wallet.labelForKeyguard || wallet.accounts.values().next().value.label,
                type: walletTypeName[wallet.type],
                // permissions: [], // TODO
            },
        };

        setTimeout(() => this.$rpc.resolve(result), StatusScreen.SUCCESS_REDIRECT_DELAY - (Date.now() - startTime));
    }
}
</script>
