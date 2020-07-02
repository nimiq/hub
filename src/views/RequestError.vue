<template>
    <div class="container pad-bottom">
        <SmallPage>
            <StatusScreen
                state="error"
                :title="$t('Invalid request')"
                :message="$t('Something went wrong with your request. Please try again.')"
                :mainAction="_mainAction"
                @main-action="_close"
            />
        </SmallPage>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { SmallPage } from '@nimiq/vue-components';
import StatusScreen from '../components/StatusScreen.vue';

@Component({components: {StatusScreen, SmallPage}})
export default class RequestError extends Vue {
    private _close() {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            window.close();
        }
    }

    private get _mainAction(): string {
        return window.history.length > 1 ? this.$t('Go back') as string : this.$t('Close') as string;
    }
}
</script>
