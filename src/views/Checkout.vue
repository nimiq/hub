<template>
    <div>
        <PaymentInfoLine style="color: white" :amount="199000" :networkFee="1000" :networkFeeEditable="false"
                         origin="shop.nimiq.com"/>
        <small-page>
            <div class="visible-area">
                <div class="multi-pages" :style="'left: -'+((page-1)*100)+'%'">
                    <LoginSelector/>
                    <AccountSelector/>
                </div>
            </div>
        </small-page>
    </div>
</template>

<script lang="ts">
    import {Component, Vue} from 'vue-property-decorator';
    import {AccountSelector, LoginSelector, PaymentInfoLine, SmallPage} from '@nimiq/vue-components';

    @Component({components: {PaymentInfoLine, SmallPage, AccountSelector, LoginSelector}})
    export default class Checkout extends Vue {
        private page: number = 1;
    }
</script>

<style scoped>

    .visible-area {
        overflow: hidden;
        flex: 1;
        display: flex
    }

    .multi-pages {
        position: relative;
        flex: 1;
        display: grid;
        grid-template-columns: 100vw 100vw;
        transition: all .5s ease-in-out;
    }

    @media (min-width: 490px) {
        .multi-pages {
            grid-template-columns: 28em 28em;
        }
    }
</style>
