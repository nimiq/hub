<template></template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { State } from 'vuex-class';

@Component
export default class ErrorHandler extends Vue {
    @State protected keyguardResult!: Error;

    public async created() {
        if (!(this.keyguardResult instanceof Error)) return;
        if (this.requestSpecificErrors()) return;

        // TODO proper Error Handling
        // console.log(this.keyguardResult);

        this.$rpc.reject(this.keyguardResult);
    }

    /**
     * use this in derived classes in case a specific error needs special handling.
     */
    protected requestSpecificErrors(): boolean {
        return false;
    }
}
</script>
