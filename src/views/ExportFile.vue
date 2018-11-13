<script lang="ts">
import { Component, Emit, Vue } from 'vue-property-decorator';
import { ParsedExportFileRequest } from '../lib/RequestTypes';
import { State } from 'vuex-class';
import RpcApi from '../lib/RpcApi';
import { ExportFileRequest } from '@nimiq/keyguard-client';
import { State as RpcState, ResponseStatus } from '@nimiq/rpc';
import { KeyStore } from '@/lib/KeyStore';
import staticStore, {Static} from '../lib/StaticStore';

@Component({})
export default class ExportFile extends Vue {
    @Static private request!: ParsedExportFileRequest;

    public async created() {
        const key = await KeyStore.Instance.get(this.request.keyId);
        if (!key) throw new Error('KeyId not found');

        const request: ExportFileRequest = {
            appName: this.request.appName,
            keyId: this.request.keyId,
            keyLabel: key.label,
        };

        const client = RpcApi.createKeyguardClient(this.$store, staticStore);
        client.exportFile(request).catch(console.error); // TODO: proper error handling
    }
}
</script>
