<script lang="ts">
    import { Component, Prop, Vue } from 'vue-property-decorator';
    import { LabelInput as StandardLabelInput } from '@nimiq/vue-components';
    import { LABEL_MAX_LENGTH } from '@/lib/Constants';

    @Component({components: {}})
    export default class LabelInput extends StandardLabelInput {
         @Prop({ default: LABEL_MAX_LENGTH }) protected maxBytes?: number;
    }
</script>