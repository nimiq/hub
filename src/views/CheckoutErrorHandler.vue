<template></template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { ResponseStatus, State as RpcState } from '@nimiq/rpc';
import { RpcResult } from '@nimiq/keyguard-client';
import ErrorHandler from './ErrorHandler.vue';
import { RequestType } from '@/lib/RequestTypes';

@Component({})
export default class CheckoutErrorHandler extends ErrorHandler {
    protected requestSpecificErrors(): boolean {
        if (this.keyguardResult instanceof Error
            && this.keyguardResult.message === 'Request aborted') {
            // this Error should be more specific. history.back does not work incredibly well
            this.$router.push({name: RequestType.CHECKOUT});
            return true;
        }
        return false;
    }
}
</script>
