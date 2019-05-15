// rollup.config.js
import resolve from 'rollup-plugin-node-resolve';
import { terser } from "rollup-plugin-terser";

export default [
    {
        input: 'build/client/HubApi.js',
        output: {
            file: 'dist/HubApi.umd.js',
            format: 'umd',
            name: 'HubApi',
            globals: { '@nimiq/rpc': 'rpc' }
        },
        external: [ '@nimiq/rpc' ]
    },
    {
        input: 'build/client/HubApi.js',
        output: {
            file: 'dist/HubApi.es.js',
            format: 'es',
            name: 'HubApi',
            globals: { '@nimiq/rpc': 'rpc' }
        },
        external: [ '@nimiq/rpc' ]
    },
    {
        input: 'build/client/HubApi.js',
        output: {
            file: 'dist/standalone/HubApi.standalone.umd.js',
            format: 'umd',
            name: 'HubApi',
            globals: { '@nimiq/rpc': 'rpc' }
        },
        plugins: [ resolve(), terser() ]
    },
    {
        input: 'build/client/HubApi.js',
        output: {
            file: 'dist/standalone/HubApi.standalone.es.js',
            format: 'es',
            name: 'HubApi',
            globals: { '@nimiq/rpc': 'rpc' }
        },
        plugins: [ resolve(), terser() ]
    }
];
