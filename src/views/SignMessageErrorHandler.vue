<template></template>

<script lang="ts">
import { Component } from 'vue-property-decorator';
import ErrorHandler from './ErrorHandler.vue';
import { RequestType } from '@/lib/RequestTypes';
import { ParsedSignMessageRequest } from '../lib/RequestTypes';
import { Static } from '../lib/StaticStore';

@Component
export default class SignMessageErrorHandler extends ErrorHandler {
    @Static private request!: ParsedSignMessageRequest;

    protected requestSpecificErrors(): boolean {
        if (this.keyguardResult instanceof Error && this.keyguardResult.message === 'Request aborted') {
            if (this.request.walletId && this.request.signer) {
                // This was a hand-through request, let it be a hand-through result
                return false;
            }
            this.$router.push({name: `${RequestType.SIGN_MESSAGE}-overview`});
            return true;
        }
        return false;
    }
}
</script>
