<template></template>

<script lang="ts">
import { Component } from 'vue-property-decorator';
import ErrorHandler from './ErrorHandler.vue';
import { RequestType } from '@/lib/RequestTypes';

@Component
export default class SignupErrorHandler extends ErrorHandler {
    protected requestSpecificErrors(): boolean {
        if (this.keyguardResult instanceof Error
            && this.keyguardResult.message === 'Request aborted') {
            this.$router.push({name: RequestType.ONBOARD});
            return true;
        }
        return false;
    }
}
</script>
