<template>
    <div class="loading-spinner" />
</template>

<script lang="ts">
import {Component, Vue} from 'vue-property-decorator';
@Component
export default class LoadingSpinner extends Vue {}
</script>

<style scoped>
    .loading-spinner {
        background-image: url("data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" width=\"64\" height=\"64\"><style>@keyframes dash-animation {to { transform: rotate(240deg) translateZ(0); } } %23circle { animation: 3s dash-animation infinite linear; transform: rotate(240deg) translateZ(0); transform-origin: center; }</style><defs><clipPath id=\"hexClip\"><path clip-rule=\"evenodd\" d=\"M16 4.29h32L64 32 48 59.71H16L0 32zm4.62 8h22.76L54.76 32 43.38 51.71H20.62L9.24 32z\"/></clipPath></defs><path fill-rule=\"evenodd\" d=\"M16 4.29h32L64 32 48 59.71H16L0 32zm4.62 8h22.76L54.76 32 43.38 51.71H20.62L9.24 32z\" fill=\"%23fff\" opacity=\".2\"/><g clip-path=\"url(%23hexClip)\"><circle id=\"circle\" cx=\"32\" cy=\"32\" r=\"16\" fill=\"none\" stroke-width=\"32\" stroke=\"%23F6AE2D\" stroke-dasharray=\"16.666 84.666\"/></g></svg>");
        background-repeat: no-repeat;
        background-position: center;
        background-size: 9rem;
        z-index: 1;
        display: block;
        height: 9rem;
        width: 10rem;
    }
</style>
