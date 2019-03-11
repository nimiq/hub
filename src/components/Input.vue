<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator';
import { LabelInput as StandardInput } from '@nimiq/vue-components';
import { LABEL_MAX_LENGTH } from '@/lib/Constants';

@Component
export default class Input extends StandardInput {
        @Prop({ default: LABEL_MAX_LENGTH }) protected maxBytes!: number;
}
</script>
