<template></template>

<script lang="ts">
import { Component } from 'vue-property-decorator';
import ErrorHandler from './ErrorHandler.vue';
import { RequestType } from '@/lib/RequestTypes';
import { ParsedSignMessageRequest } from '../lib/RequestTypes';

@Component
export default class SignMessageErrorHandler extends ErrorHandler {
    protected requestSpecificErrors(): boolean {
        if (this.keyguardResult instanceof Error && this.keyguardResult.message === 'Request aborted') {
            if ((this.request as ParsedSignMessageRequest).signer) {
                // This was a hand-through request, let it be a hand-through result
                return false;
            }
            this.$rpc.routerReplace(RequestType.SIGN_MESSAGE);
            return true;
        }
        return false;
    }
}
</script>
