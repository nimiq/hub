<template>
    <div class="container pad-bottom">
        <SmallPage>
            <StatusScreen
                state="warning"
                title="No cash found"
                message="This link does not include any cash."
                mainAction="Close"
                @main-action="_close"
            />
        </SmallPage>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { SmallPage } from '@nimiq/vue-components';
import StatusScreen from '../components/StatusScreen.vue';

@Component({components: {SmallPage, StatusScreen}})
export default class CashlinkReceive extends Vue {
    private _close() {
        window.close();
    }
}
</script>
