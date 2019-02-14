<template></template>

<script lang="ts">
import { Component } from 'vue-property-decorator';
import ErrorHandler from './ErrorHandler.vue';
import { RequestType } from '@/lib/RequestTypes';
import { Errors } from '@nimiq/keyguard-client';

@Component
export default class LoginErrorHandler extends ErrorHandler {
    protected requestSpecificErrors(): boolean {
        if (this.keyguardResult instanceof Error
            && this.keyguardResult.message === Errors.Messages.GOTO_CREATE) {
            this.$rpc.routerReplace(RequestType.SIGNUP);
            return true;
        }
        return false;
    }
}
</script>
