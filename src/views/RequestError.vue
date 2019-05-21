<template>
    <div class="container">
        <SmallPage>
            <StatusScreen
                state="error"
                title="Invalid request"
                message="Something went wrong with your request. Please try again."
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

@Component({components: {StatusScreen, SmallPage}})
export default class RequestError extends Vue {
    private _close() {
        window.close();
    }
}
</script>
