// rollup.config.js
import resolve from 'rollup-plugin-node-resolve';
import { terser } from "rollup-plugin-terser";

export default [
    {
        input: 'build/client/AccountsClient.js',
        output: {
            file: 'dist/AccountsClient.umd.js',
            format: 'umd',
            name: 'AccountsClient',
            globals: { '@nimiq/rpc': 'rpc' }
        },
        external: [ '@nimiq/rpc' ]
    },
    {
        input: 'build/client/AccountsClient.js',
        output: {
            file: 'dist/AccountsClient.es.js',
            format: 'es',
            name: 'AccountsClient',
            globals: { '@nimiq/rpc': 'rpc' }
        },
        external: [ '@nimiq/rpc' ]
    },
    {
        input: 'build/client/AccountsClient.js',
        output: {
            file: 'dist/standalone/AccountsClient.umd.js',
            format: 'umd',
            name: 'AccountsClient',
            globals: { '@nimiq/rpc': 'rpc' }
        },
        plugins: [ resolve(), terser() ]
    },
    {
        input: 'build/client/AccountsClient.js',
        output: {
            file: 'dist/standalone/AccountsClient.es.js',
            format: 'es',
            name: 'AccountsClient',
            globals: { '@nimiq/rpc': 'rpc' }
        },
        plugins: [ resolve(), terser() ]
    }
];
