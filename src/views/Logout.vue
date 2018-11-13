<script lang="ts">
import { Component, Emit, Vue } from 'vue-property-decorator';
import { ParsedLogoutRequest } from '../lib/RequestTypes';
import { State } from 'vuex-class';
import RpcApi from '../lib/RpcApi';
import { RemoveKeyRequest } from '@nimiq/keyguard-client';
import { KeyStore } from '@/lib/KeyStore';
import staticStore, {Static} from '../lib/StaticStore';

@Component({})
export default class Logout extends Vue {
    @Static private request!: ParsedLogoutRequest;

    public async created() {
        const key = await KeyStore.Instance.get(this.request.keyId);
        if (!key) throw new Error('KeyId not found');

        const request: RemoveKeyRequest = {
            appName: this.request.appName,
            keyId: this.request.keyId,
            keyLabel: key.label,
        };

        const client = RpcApi.createKeyguardClient(this.$store, staticStore);
        client.remove(request).catch(console.error); // TODO: proper error handling
    }
}
</script>
