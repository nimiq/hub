// rollup.config.js
import resolve from 'rollup-plugin-node-resolve';
import { terser } from "rollup-plugin-terser";

export default [
    {
        input: 'build/client/AccountsManagerClient.js',
        output: {
            file: 'dist/AccountsManagerClient.umd.js',
            format: 'umd',
            name: 'AccountsManagerClient',
            globals: { '@nimiq/rpc': 'rpc' }
        },
        external: [ '@nimiq/rpc' ]
    },
    {
        input: 'build/client/AccountsManagerClient.js',
        output: {
            file: 'dist/AccountsManagerClient.es.js',
            format: 'es',
            name: 'AccountsManagerClient',
            globals: { '@nimiq/rpc': 'rpc' }
        },
        external: [ '@nimiq/rpc' ]
    },
    {
        input: 'build/client/AccountsManagerClient.js',
        output: {
            file: 'dist/standalone/AccountsManagerClient.umd.js',
            format: 'umd',
            name: 'AccountsManagerClient',
            globals: { '@nimiq/rpc': 'rpc' }
        },
        plugins: [ resolve(), terser() ]
    },
    {
        input: 'build/client/AccountsManagerClient.js',
        output: {
            file: 'dist/standalone/AccountsManagerClient.es.js',
            format: 'es',
            name: 'AccountsManagerClient',
            globals: { '@nimiq/rpc': 'rpc' }
        },
        plugins: [ resolve(), terser() ]
    }
];
