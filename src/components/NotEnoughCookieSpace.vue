<template>
    <div class="container">
        <SmallPage>
            <StatusScreen
                state='error'
                :title='$t("Action not possible")'
                :message='$t("Unfortunately, due to restrictions of Safari you cannot add more accounts and/or addresses. Please log out of unused accounts to free up space.")'
                :mainAction='$t("Continue")'
                @main-action='onContinue'
            />
        </SmallPage>
    </div>
</template>

<script lang="ts">
import { Component, Prop, Watch, Vue } from 'vue-property-decorator';
import { SmallPage } from '@nimiq/vue-components';
import StatusScreen from './StatusScreen.vue';
import { ERROR_COOKIE_SPACE } from '../lib/Constants';

@Component({components: {StatusScreen, SmallPage}})
export default class NotEnoughCookieSpace extends Vue {
    private onContinue() {
        this.$rpc.reject(new Error(ERROR_COOKIE_SPACE));
    }
}
</script>
