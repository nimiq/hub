<<script lang="ts">
import { Component, Emit, Vue } from 'vue-property-decorator';
import { ParsedLoginRequest } from '../lib/RequestTypes';
import { State } from 'vuex-class';
import RpcApi from '../lib/RpcApi';
import { ImportRequest } from '@nimiq/keyguard-client';
import staticStore, { Static } from '../lib/StaticStore';

@Component({components: {}})
export default class Login extends Vue {
    @Static private request!: ParsedLoginRequest;

    public created() {
        const request: ImportRequest = {
            appName: this.request.appName,
            defaultKeyPath: `m/44'/242'/0'/0'`,
            requestedKeyPaths: [`m/44'/242'/0'/0'`],
        };

        const client = RpcApi.createKeyguardClient(this.$store, staticStore);
        client.import(request).catch(console.error); // TODO: proper error handling
    }
}
</script>
