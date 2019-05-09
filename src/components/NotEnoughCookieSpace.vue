<template>
    <div class="container">
        <SmallPage>
            <Loader
                state='error'
                title='Action not possible'
                message='Unfortunately, due to restrictions of Safari you cannot add more accounts and/or addresses. Please log out of unused accounts to free up space.'
                mainAction='Continue'
                @main-action='onContinue'
            />
        </SmallPage>
    </div>
</template>

<script lang="ts">
import { Component, Prop, Watch, Vue } from 'vue-property-decorator';
import Loader from './Loader.vue';
import { SmallPage } from '@nimiq/vue-components';

@Component({components: {Loader, SmallPage}})
export default class NotEnoughCookieSpace extends Vue {
    private onContinue() {
        this.$rpc.reject(new Error('Not enough cookie space'));
    }
}
</script>
