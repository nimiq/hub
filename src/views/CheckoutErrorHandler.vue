<template></template>
<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { State } from 'vuex-class';
import { ResponseStatus, State as RpcState } from '@nimiq/rpc';
import { RpcResult } from '@nimiq/keyguard-client';
import staticStore, { Static } from '@/lib/StaticStore';
import ErrorHandler from './ErrorHandler.vue';

@Component({})
export default class CheckoutErrorHandler extends ErrorHandler {
    protected requestSpecificErrors(): boolean {
        if (this.keyguardResult instanceof Error
            && this.keyguardResult.message === 'Request aborted') {
            // this Error should be more specific. history.back does not work incredibly well
            this.$router.push({name: 'checkout'});
            return true;
        }
        return false;
    }
}
</script>
