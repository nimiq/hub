<script lang="ts">
import { Component, Prop } from 'vue-property-decorator';
import { LabelInput as StandardInput } from '@nimiq/vue-components';
import { LABEL_MAX_LENGTH } from '@/lib/Constants';

// @ts-ignore Property 'options' does not exist on type 'typeof LabelInput'.
@Component({ name: StandardInput.options.name }) // preserve the parent name for translation file loading
export default class Input extends StandardInput {
    @Prop({ default: LABEL_MAX_LENGTH }) protected maxBytes!: number;
}
</script>
