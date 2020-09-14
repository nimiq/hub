// rollup.config.js
import resolve from 'rollup-plugin-node-resolve';
import json from '@rollup/plugin-json';
import { terser } from 'rollup-plugin-terser';

export default [
    {
        input: 'build/HubApi.js',
        output: {
            file: 'dist/HubApi.umd.js',
            format: 'umd',
            name: 'HubApi',
            globals: { '@nimiq/rpc': 'rpc' }
        },
        external: [ '@nimiq/rpc' ],
        plugins: [ json() ],
    },
    {
        input: 'build/HubApi.js',
        output: {
            file: 'dist/HubApi.es.js',
            format: 'es',
            name: 'HubApi',
            globals: { '@nimiq/rpc': 'rpc' }
        },
        external: [ '@nimiq/rpc' ],
        plugins: [ json() ],
    },
    {
        input: 'build/HubApi.js',
        output: {
            file: 'dist/standalone/HubApi.standalone.umd.js',
            format: 'umd',
            name: 'HubApi',
            globals: { '@nimiq/rpc': 'rpc' }
        },
        plugins: [ resolve(), json(), terser() ],
    },
    {
        input: 'build/HubApi.js',
        output: {
            file: 'dist/standalone/HubApi.standalone.es.js',
            format: 'es',
            name: 'HubApi',
            globals: { '@nimiq/rpc': 'rpc' }
        },
        plugins: [ resolve(), json(), terser() ],
    }
];
