<template>
    <div class="success nq-green-bg">
        <div class="nq-icon checkmark-circle"></div>
        <h1 v-html="parsedText" class="nq-h1"></h1>
        <div style="flex-grow: 1;"></div>

        <button @click="$emit('continue')" class="nq-button green inverse" :disabled="disabled">{{ getButtonText }}</button>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Prop } from 'vue-property-decorator';

@Component
export default class Success extends Vue {
    @Prop(String) private text?: string;
    @Prop(String) private appName?: string;
    @Prop(String) private buttonText?: string;
    @Prop(Boolean) private disabled?: boolean;

    private get parsedText(): string {
        if (!this.text) return '';

        return this.text
            .replace(/<(.|\n)*?>/g, '')
            .replace(/\[br\]/g, '<br/>');
    }

    private get getButtonText(): string {
        if (this.buttonText) return this.buttonText;
        if (this.appName) return 'Back to ' + this.appName;
        return 'Continue';
    }
}
</script>

<style scoped>
    .success {
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        align-items: center;
        flex-grow: 1;
        margin: 1rem;
        border-radius: 0.5rem;
        z-index: 1000;
    }

    .checkmark-circle {
        width: 12.5rem;
        height: 12.5rem;
        margin-top: 20%;
        margin-bottom: 2rem;
    }

    h1 {
        text-align: center;
        max-width: 50rem;
        margin-left: auto;
        margin-right: auto;
    }

    button {
        margin: 3rem 0;
    }
</style>
