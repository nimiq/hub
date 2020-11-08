<template>
    <div class="label-avatar" :class="[{ initial: !_isUnlabeled }, _backgroundColor]">
        <svg v-if="_isUnlabeled" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 63 63">
            <path opacity=".25" fill="#1F2348" d="M17,47.9a20.59,20.59,0,0,0-2.86,3.49,1,1,0,0,1-1.51.22,27.49,27.49,0,1,1,37.74,0,1,1,0,0,1-1.51-.23A20.82,20.82,0,0,0,17,47.9ZM31.5,63A31.5,31.5,0,1,0,0,31.5,31.5,31.5,0,0,0,31.5,63Zm0-25.41a12,12,0,1,0-12-12A12,12,0,0,0,31.5,37.59Z"/>
        </svg>
        <span v-else class="initial">{{ _initial }}</span>
    </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';
// @ts-ignore Could not find a declaration file for module '@nimiq/iqons'.
import { getBackgroundColorName } from '@nimiq/iqons';

@Component
export default class LabelAvatar extends Vue {
    @Prop(String) public label?: string;

    private get _isUnlabeled() {
        return !this.label;
    }

    private get _initial() {
        return this.label ? this.label[0] : '';
    }

    private get _backgroundColor() {
        if (!this.label) return 'transparent';
        let color = getBackgroundColorName(this.label).toLowerCase();

        // Convert from public to CSS names
        if (color === 'yellow') color = 'gold';
        else if (color === 'indigo') color = 'blue';
        else if (color === 'blue') color = 'light-blue';
        else if (color === 'teal') color = 'green';
        else if (color === 'green') color = 'light-green';

        return `nq-${color}-bg`;
    }
}
</script>

<style scoped>
    .label-avatar {
        width: 5.25rem;
        height: 5.25rem;
        font-size: 2.5rem;
    }

    .initial {
        text-transform: uppercase;
        font-weight: bold;
        line-height: 2;
        border-radius: 50%;
        display: flex;
        justify-content: center;
        align-items: center;
        color: white;
    }

    svg {
        width: 100%;
        height: auto;
    }
</style>
