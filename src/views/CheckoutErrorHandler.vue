<template></template>

<script lang="ts">
import { Component } from 'vue-property-decorator';
import ErrorHandler from './ErrorHandler.vue';
import { RequestType, ParsedCheckoutRequest } from '@/lib/RequestTypes';

@Component
export default class CheckoutErrorHandler extends ErrorHandler {
    protected requestSpecificErrors(): boolean {
        if (this.keyguardResult instanceof Error && this.keyguardResult.message === 'Request aborted') {
            if ((this.request as ParsedCheckoutRequest).sender) {
                // This was a hand-through request, let it be a hand-through result
                return false;
            }
            this.$rpc.routerReplace(RequestType.CHECKOUT);
            return true;
        }
        return false;
    }
}
</script>
